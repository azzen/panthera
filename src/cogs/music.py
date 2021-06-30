# -*- coding: utf-8 -*-
# Heavily inspired by https://gist.github.com/vbe0201/ade9b80f2d3b64643d854938d40a0a2d

import asyncio
import functools
import itertools
import math
import random

import discord
import youtube_dl
from async_timeout import timeout
from discord.ext import commands
from libs.mongo import client as mongo_client
from libs.print import Log as log

youtube_dl.utils.bug_reports_message = lambda: ''


class VoiceError(Exception):
    pass


class YoutubeDLError(Exception):
    pass


class YouTubeDLSource(discord.PCMVolumeTransformer):
    YouTubeDL_OPTIONS = {
        'format': 'bestaudio/best',
        'extractaudio': True,
        'audioformat': 'mp3',
        'outtmpl': '%(extractor)s-%(id)s-%(title)s.%(ext)s',
        'restrictfilenames': True,
        'noplaylist': True,
        'nocheckcertificate': True,
        'ignoreerrors': False,
        'logtostderr': False,
        'quiet': True,
        'no_warnings': True,
        'default_search': 'auto',
        'source_address': '0.0.0.0',
    }

    FFmpeg_OPTIONS = {
        'before_options': '-reconnect 1 -reconnect_streamed 1 -reconnect_delay_max 5',
        'options': '-vn',
    }

    ydl = youtube_dl.YoutubeDL(YouTubeDL_OPTIONS)

    def __init__(self, ctx: commands.Context, source: discord.FFmpegPCMAudio, *, data: dict):
        super().__init__(source, volume=0.5)
        self.requester = ctx.author
        self.channel = ctx.channel
        self.data = data
        self.uploader = data.get('uploader')
        self.thumbnail = data.get('thumbnail')
        self.title = data.get('title')
        self.duration = self.format_duration(int(data.get('duration')))
        self.url = data.get('webpage_url')
        self.stream_url = data.get('url')

    def __str__(self):
        return f'*{self.title}* by {self.uploader}'

    @classmethod
    async def create_source(cls, ctx: commands.Context, search: str, *, loop: asyncio.BaseEventLoop = None):
        loop = loop or asyncio.get_event_loop()

        partial = functools.partial(cls.ydl.extract_info, search, download=False, process=False)
        data = await loop.run_in_executor(None, partial)

        if data is None:
            raise YoutubeDLError(f'Couldn\'t find anything that matches {search}')
        if 'entries' not in data:
            process_info = data
        else:
            process_info = None
            for entry in data['entries']:
                if entry:
                    process_info = entry
                    break
            if process_info is None:
                raise YoutubeDLError(f'Couldn\'t find anything that matches {search}')

        webpage_url = process_info['webpage_url']
        partial = functools.partial(cls.ydl.extract_info, webpage_url, download=False)
        processed_info = await loop.run_in_executor(None, partial)
        if processed_info is None:
            raise YoutubeDLError(f'Couldn\'t fetch {webpage_url}')

        if 'entries' not in processed_info:
            info = processed_info
        else:
            info = None
            while info is None:
                try:
                    info = processed_info['entries'].pop(0)
                except IndexError:
                    raise YoutubeDLError(f'Couldn\t retrieve any match for {webpage_url}')
        return cls(ctx, discord.FFmpegPCMAudio(info['url'], **cls.FFmpeg_OPTIONS), data=info)

    @staticmethod
    def format_duration(d: int):
        mins, secs = divmod(d, 60)
        hrs, mins = divmod(mins, 60)
        if hrs > 0:
            return f'{hrs:d}:{mins:02d}:{secs:02d}'
        return f'{mins:02d}:{secs:02d}'


class YouTubeDLHelper:
    @staticmethod
    def parse_playlist(search: str):
        opts = {
            'ignoreerrors': True,
            'quiet': True,
            'quit': True
        }
        with youtube_dl.YoutubeDL(opts) as ydl:
            playlist_info = ydl.extract_info(search, download=False)
            playlist_title = playlist_info['title']
            playlist = dict()
            for video in playlist_info['entries']:
                if not video:
                    continue
                for _ in ['id', 'title']:
                    playlist[video.get('title')] = 'https://www.youtube.com/watch?v=' + video.get('id')
            log.debug(playlist)
            return playlist, playlist_title


class Song:
    __slots__ = ('source', 'requester')

    def __init__(self, source: YouTubeDLSource):
        self.source = source
        self.requester = source.requester

    def create_embed(self):
        embed = (discord.Embed(title='Now playing',
                               description=f'{self.source.title}',
                               color=0xffee00)
                 .add_field(name='Duration', value=self.source.duration)
                 .add_field(name='Requested by', value=self.requester.mention)
                 .add_field(name='Uploader', value=self.source.uploader)
                 .add_field(name='URL', value=f'[Link]({self.source.url})')
                 .set_thumbnail(url=self.source.thumbnail))

        return embed


class SongQueue(asyncio.Queue):
    def __getitem__(self, item):
        if isinstance(item, slice):
            return list(itertools.islice(self._queue, item.start, item.stop, item.step))
        else:
            return self._queue[item]

    def __iter__(self):
        return self._queue.__iter__()

    def __len__(self):
        return self.qsize()

    def clear(self):
        self._queue.clear()

    def shuffle(self):
        random.shuffle(self._queue)

    def remove(self, index: int):
        del self._queue[index]


class VoiceState:
    def __init__(self, bot: commands.Bot, ctx: commands.Context):
        self.bot = bot
        self._ctx = ctx

        self.current = None
        self.voice = None
        self.next = asyncio.Event()
        self.songs = SongQueue()

        self._loop = False
        self.skip_votes = set()

        self.audio_player = bot.loop.create_task(self.audio_player_task())

    def __del__(self):
        self.audio_player.cancel()

    @property
    def loop(self):
        return self._loop

    @loop.setter
    def loop(self, value: bool):
        self._loop = value

    @property
    def is_playing(self):
        return self.voice and self.current

    async def audio_player_task(self):
        while True:
            self.skip_votes.clear()
            self.next.clear()
            if not self.loop:
                try:
                    async with timeout(120):
                        self.current = await self.songs.get()
                except asyncio.TimeoutError:
                    self.bot.loop.create_task(self.stop())
                    return
            self.voice.play(self.current.source, after=self.play_next_song)
            await self.current.source.channel.send(embed=self.current.create_embed())
            await self.next.wait()

    def play_next_song(self, error=None):
        if error:
            raise VoiceError(str(error))
        self.next.set()

    def skip(self):
        self.skip_votes.clear()
        if self.is_playing:
            self.voice.stop()

    async def stop(self):
        self.songs.clear()
        if self.voice:
            await self.voice.disconnect()
            self.voice = None


class Music(commands.Cog):
    music_channels: dict[int, discord.VoiceChannel] = {}

    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.voice_states = {}

    def get_voice_state(self, ctx: commands.Context):
        state = self.voice_states.get(ctx.guild.id)
        if not state:
            state = VoiceState(self.bot, ctx)
            self.voice_states[ctx.guild.id] = state
        return state

    def cog_unload(self):
        for state in self.voice_states.values():
            self.bot.loop.create_task(state.stop())

    def cog_check(self, ctx: commands.Context):
        if not ctx.guild:
            raise commands.NoPrivateMessage('This commands can\'t be used in DM channels')

        return True

    async def cog_before_invoke(self, ctx: commands.Context):
        ctx.voice_state = self.get_voice_state(ctx)

    async def cog_command_error(self, ctx: commands.Context, error: commands.CommandError):
        await ctx.send(f'An error occurred: {str(error)}')

    @commands.Cog.listener()
    async def on_ready(self):
        for guild in self.bot.guilds:
            music_channel_id = mongo_client.get_music_channel_id(guild.id)
            if music_channel_id and guild.get_channel(int(music_channel_id)):
                Music.music_channels[guild.id] = guild.get_channel(int(music_channel_id))
        log.info("Initialized music module")

    @commands.command(name='join', invoke_without_subcommand=True)
    async def join(self, ctx: commands.Context):
        if ctx.voice_client and ctx.voice_client.channel == Music.music_channels[ctx.guild.id]:
            raise commands.CommandError('The bot is already in a voice channel!')
        destination = Music.music_channels[ctx.guild.id]
        ctx.voice_state.voice = await destination.connect()
        await ctx.send(f'Connected to {destination.mention}')

    @commands.command(name='now', aliases=['current', 'playing'])
    async def now(self, ctx: commands.Context):
        if not ctx.voice_state.current is None:
            await ctx.send(embed=ctx.voice_state.current.create_embed())
        else:
            await ctx.send('No music playing!')

    @commands.command(name='queue')
    async def queue(self, ctx: commands.Context, *, page: int = 1):
        if len(ctx.voice_state.songs) == 0:
            return await ctx.send('Queue is empty!')

        items_per_page = 10
        pages = math.ceil(len(ctx.voice_state.songs) / items_per_page)
        start = (page - 1) * items_per_page
        end = start + items_per_page
        queue = ''
        for pos, song in enumerate(ctx.voice_state.songs[start:end], start=start):
            queue += f'`{pos + 1}.` [{song.source.title}]({song.source.url})\n'

        embed = (discord.Embed(title='Panthera\'s playlist',
                               color=0xffee00,
                               description=f'**Tracks count: {len(ctx.voice_state.songs)}**\n\n{queue}')
                 .set_footer(text=f'Viewing page: {page}/{pages}'))
        await ctx.send(embed=embed)

    @commands.command(name='leave', aliases=['disconnect', 'quit'])
    @commands.has_permissions(manage_guild=True)
    async def leave(self, ctx: commands.Context):
        if not ctx.voice_state.voice:
            return await ctx.send('Not connected to any voice channel')
        await ctx.voice_state.stop()
        del self.voice_states[ctx.guild.id]

    @commands.command(name='pause')
    @commands.has_permissions(manage_guild=True)
    async def pause(self, ctx: commands.Context):
        if ctx.voice_state.is_playing and ctx.voice_state.voice.is_playing():
            ctx.voice_state.voice.pause()
            await ctx.message.add_reaction('⏯')

    @commands.command(name='resume')
    @commands.has_permissions(manage_guild=True)
    async def resume(self, ctx: commands.Context):
        if ctx.voice_state.voice.is_paused():
            ctx.voice_state.voice.resume()
            await ctx.message.add_reaction('⏯')

    @commands.command(name='stop')
    @commands.has_permissions(manage_guild=True)
    async def stop(self, ctx: commands.Context):
        ctx.voice_state.songs.clear()

        if ctx.voice_state.is_playing:
            ctx.voice_state.current = None
            ctx.voice_state.voice.stop()
            await ctx.message.add_reaction('⏹')

    @commands.command(name='play')
    async def play(self, ctx: commands.Context, *, search: str):
        if not ctx.voice_state.voice:
            await ctx.invoke(self.join)
        if search.__contains__('?list='):
            async with ctx.typing():
                message = await ctx.send('Parsing playlist, this might take a while!')
                playlist, playlist_title = YouTubeDLHelper.parse_playlist(search)
                for title, link in playlist.items():
                    try:
                        source = await YouTubeDLSource.create_source(ctx, link, loop=self.bot.loop)
                    except YoutubeDLError as e:
                        await ctx.send(f'An error occurred while processing this request: {str(e)}')
                    else:
                        song = Song(source)
                        await ctx.voice_state.songs.put(song)
                await message.edit(content=f'Enqueued `{playlist.__len__()}` songs from *{playlist_title}*')
        else:
            async with ctx.typing():
                try:
                    source = await YouTubeDLSource.create_source(ctx, search, loop=self.bot.loop)
                except YoutubeDLError as e:
                    await ctx.send(f'An error occurred while processing this request: {str(e)}')
                else:
                    song = Song(source)
                    await ctx.voice_state.songs.put(song)
                    await ctx.send(f'Enqueued {source}')

    @commands.command(name='skip')
    async def skip(self, ctx: commands.Context):
        if not ctx.voice_state.is_playing:
            return await ctx.send('Not playing any music right now!')
        voter = ctx.message.author
        if voter == ctx.voice_state.current.requester:
            await ctx.message.add_reaction('⏭')
            ctx.voice_state.skip()
        elif voter.id not in ctx.voice_state.skip_votes:
            ctx.voice_state.skip_votes.add(voter.id)
            total_votes = len(ctx.voice_state.skip_votes)
            if total_votes >= 3:
                await ctx.message.add_reaction('⏭')
                ctx.voice_state.skip()
            else:
                await ctx.send(f'Skip vote added, currently at {total_votes}/3')
        else:
            await ctx.send('You have already voted to skip this song!')

    @join.before_invoke
    @play.before_invoke
    @pause.before_invoke
    @resume.before_invoke
    async def ensure_voice_state(self, ctx: commands.Context):
        if not Music.music_channels[ctx.guild.id]:
            raise commands.CommandError('A music channel must be defined using the command .channel <#channel> to use this interaction.')
        if ctx.author not in Music.music_channels[ctx.guild.id].members:
            raise commands.CommandError('You must be in the music channel to use this command.')


def setup(bot):
    bot.add_cog(Music(bot))
