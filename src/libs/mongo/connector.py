import os
from pymongo import MongoClient
from src.libs.print import Log as log


class MongoConnector:
    def __init__(self, password, user, host, port, auth_source, database):
        connection_string = f"mongodb://{user}:{password}@{host}:{port}/?authSource={auth_source}"
        try:
            mongo_client = MongoClient(connection_string)
            self.client = mongo_client[database]
            log.success("Successfully connected to MongoDB!")
        except Exception as e:
            log.error(f"Connection to MongoDB failed: {e}")

    def get_guild(self, guild_id):
        guild = self.client.guilds.find_one({"guild_id": guild_id})
        if not guild:
            raise Exception("Guild not found")
        return guild

    def get(self, guild_id, what):
        guild = self.get_guild(guild_id)
        if what not in guild:
            raise Exception(f"Given key {what} wasn't found in guild: {guild_id}")
        return guild[what]

    def get_guild_log_channel(self, guild_id):
        return self.get(guild_id, "logs_channel_id")

    def get_admin_role(self, guild_id):
        return self.get(guild_id, "admin_role_id")


client = MongoConnector(os.getenv("DB_PASS"), os.getenv("DB_USER"), os.getenv("DB_HOST"),
                        os.getenv("DB_PORT"), os.getenv("DB_AUTHSOURCE"), os.getenv("DB_NAME"))
