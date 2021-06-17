import os

import discord
from dotenv import load_dotenv
from discord.ext import commands
from discord_slash import SlashCommand
load_dotenv()

bot = commands.Bot(command_prefix="!", intents=discord.Intents.all())
slash = SlashCommand(bot, sync_commands=True, sync_on_cog_reload=True)
bot.load_extension("cogs.misc")
print("Panthera is up and running!")
bot.run(os.getenv("DISCORD_TOKEN"))
