import type { FastifyReply } from 'fastify';
import { HttpStatus } from '../constants/httpStatus';

export function sendOk<T>(reply: FastifyReply, data: T) {
  return reply.status(HttpStatus.OK).send({ success: true, data });
}

export function sendCreated<T>(reply: FastifyReply, data: T) {
  return reply.status(HttpStatus.CREATED).send({ success: true, data });
}
