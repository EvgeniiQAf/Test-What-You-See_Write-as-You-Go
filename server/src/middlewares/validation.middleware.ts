import { Request, Response, NextFunction } from 'express';
import { AnyZodObject } from 'zod';

export const validate =
  (schema: AnyZodObject) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      return next();
    } catch (error: any) {
      const errorMessage = error.issues[0]?.message || 'Invalid request body';
      console.log('[VALIDATION ERROR]', errorMessage);
      return res.status(400).json({ error: errorMessage });
    }
  };
