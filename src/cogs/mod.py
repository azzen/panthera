from discord.utils import get as discord_get
from discord.ext import commands
from libs.print import Log as log
from libs.mongo import client as mongo_client


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

    def cog_check(self, ctx: commands.Context):
        if not ctx.guild:
            raise commands.NoPrivateMessage('This commands can\'t be used in DM channels')

        return True

    async def cog_command_error(self, ctx: commands.Context, error: commands.CommandError):
        await ctx.send(f'An error occurred: {str(error)}')

    @commands.command(name='invite')
    @commands.has_permissions(manage_guild=True)
    async def join(self, ctx: commands.Context):
        invite = await ctx.channel.create_invite(max_age=600, max_uses=1, reason='Automatically generated invitation link')
        dm = await ctx.author.create_dm()
        await dm.send(f'Invite URL: {invite.url}')
        await ctx.channel.send('Invite link sent.')


def setup(bot):
    bot.add_cog(ModCog(bot))
