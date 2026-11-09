import { BadRequestException, type ArgumentMetadata, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Valideert een request-body tegen een Zod-schema uit `@superette/contracts`.
 *
 * Gebruik: `@Body(new ZodValidationPipe(loginSchema)) dto: LoginInput`
 *
 * De teruggegeven waarde is het *geparseerde* resultaat, dus met defaults en
 * transformaties (lowercase e-mail, getrimde namen) al toegepast.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Validatiefout',
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    return result.data;
  }
}
