import asyncio
from discord.ext import commands
from libs.print import Log as log
from libs.mongo import client as mongo_client
# from discord_slash import cog_ext, SlashContext
# from discord_slash.utils.manage_commands import create_option


async def update_member_count(count, channel):
    await channel.edit(name=f"🧑╏Membres : {count}")


class StatsCog(commands.Cog):

    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_ready(self):
        log.info("Started server statistics auto update")
        self.bot.loop.create_task(self.update_statistics())

    async def update_statistics(self):
        while True:
            for guild in self.bot.guilds:
                channel_id = mongo_client.get_stats_channel_id(guild.id)
                if channel_id:
                    await update_member_count(guild.member_count, self.bot.get_channel(channel_id))
            await asyncio.sleep(301)


def setup(bot):
    bot.add_cog(StatsCog(bot))
