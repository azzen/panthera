from discord.ext import commands
from discord import Embed
from libs.mongo import client as mongo_client
from libs.print import Log as log
from datetime import datetime


def truncate(source, size):
    if len(source) > size:
        source = source[:size-3] + "..."
    return source


class LoggingCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_message_delete(self, message):
        if message.author == self.bot.user:
            return False
        em = Embed(color=0xffee00,
                   description=f"🗑️ Message deleted by {message.author.mention} in {message.channel.mention}",
                   timestamp=datetime.utcnow())
        em.set_author(name=f"{message.author.name}#{message.author.discriminator}", icon_url=message.author.avatar_url)
        em.add_field(name="Message content:",
                     value=truncate(message.content, 1023))
        try:
            channel_id = int(mongo_client.get_guild_log_channel(message.guild.id))
            logs_channel = self.bot.get_channel(channel_id)
            await logs_channel.send(embed=em)
        except Exception as e:
            log.error(f"MongoDB query failed: {e}")

    @commands.Cog.listener()
    async def on_member_join(self, member):
        em = Embed(color=0xffee00,
                   description=f"📥 {member.mention} joined the server.",
                   timestamp=datetime.utcnow())
        em.set_author(name=f"{member.name}#{member.discriminator}", icon_url=member.avatar_url)
        em.set_thumbnail(url=member.avatar_url)
        em.add_field(name="Account creation:", value=f"{member.created_at.strftime('%Y-%m-%d')}")
        try:
            channel_id = int(mongo_client.get_guild_log_channel(member.guild.id))
            logs_channel = self.bot.get_channel(channel_id)
            await logs_channel.send(embed=em)
        except Exception as e:
            log.error(f"MongoDB query failed: {e}")

    @commands.Cog.listener()
    async def on_member_remove(self, member):
        em = Embed(color=0xffee00,
                   description=f"📤 {member.mention} left the server.",
                   timestamp=datetime.utcnow())
        em.set_author(name=f"{member.name}#{member.discriminator}", icon_url=member.avatar_url)
        em.set_thumbnail(url=member.avatar_url)
        try:
            channel_id = int(mongo_client.get_guild_log_channel(member.guild.id))
            logs_channel = self.bot.get_channel(channel_id)
            await logs_channel.send(embed=em)
        except Exception as e:
            log.error(f"MongoDB query failed: {e}")


def setup(bot):
    bot.add_cog(LoggingCog(bot))
