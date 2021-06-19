from discord.utils import get as discord_get
from discord.ext import commands
from libs.print import Log as log
from libs.mongo import client as mongo_client
# from discord_slash import cog_ext, SlashContext
# from discord_slash.utils.manage_commands import create_option


class ModCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_member_join(self, member):
        try:
            roles_to_assign = mongo_client.get_roles_to_assign_on_join(member.guild.id)
        except Exception as e:
            log.error(f"MongoDB query failed: {e}")
            return False
        roles = []
        for role in roles_to_assign:
            roles.append(discord_get(member.guild.roles, id=role))
        await member.add_roles(*roles, reason="Roles auto-assignation on join")

def setup(bot):
    bot.add_cog(ModCog(bot))
