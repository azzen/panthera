from simple_chalk import chalk


class Log:
    @staticmethod
    def info(message):
        print(chalk.bold.white("[Panthera]"), chalk.blue(message))

    @staticmethod
    def success(message):
        print(chalk.bold.white("[Panthera]"), chalk.green(message))

    @staticmethod
    def warning(message):
        print(chalk.bold.white("[Panthera]"), chalk.orange(message))

    @staticmethod
    def error(message):
        print(chalk.bold.white("[Panthera]"), chalk.red(message))

    @staticmethod
    def debug(message):
        print(chalk.bold.white("[Panthera-Debug]"), chalk.magentaBright(message))


__all__ = [Log]
