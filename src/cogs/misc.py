import time
from discord.ext import commands
from src.libs.print import Log as log
from discord_slash import cog_ext, SlashContext


class MiscCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_ready(self):
        log.info(f"{self.bot.user} is up and running!")

    @cog_ext.cog_slash(name="ping", description="Get the ping")
    async def ping(self, ctx: SlashContext):
        t1 = time.perf_counter()
        await ctx.author.trigger_typing()
        t2 = time.perf_counter()
        delta = round((t2 - t1) * 1000)
        await ctx.send(f"Pong: {delta}ms")


def setup(bot):
    bot.add_cog(MiscCog(bot))
