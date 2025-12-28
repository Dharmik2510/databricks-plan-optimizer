import { utilities as nestWinstonUtilities, WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

export const loggerConfig: WinstonModuleOptions = {
    transports: [
        new winston.transports.Console({
            format: isProduction
                ? winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.errors({ stack: true }),
                    winston.format.json(),
                )
                : winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.ms(),
                    winston.format.errors({ stack: true }),
                    nestWinstonUtilities.format.nestLike('BrickOptima', {
                        colors: true,
                        prettyPrint: true,
                    }),
                ),
        }),
    ],
};
