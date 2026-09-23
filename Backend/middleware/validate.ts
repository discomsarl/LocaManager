import { RequestHandler } from 'express';
import { z, ZodType } from 'zod';

export function validateBody<T extends ZodType>(schema: T): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Les données envoyées sont invalides.',
        details: z.treeifyError(result.error),
      });
    }

    req.body = result.data;
    next();
  };
}
