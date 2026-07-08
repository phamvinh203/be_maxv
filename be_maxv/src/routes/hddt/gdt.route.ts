import { FastifyInstance } from "fastify";
import {
  captcha,
  login,
  purchaseInvoices,
  soldInvoices,
} from "../../controllers/client/hddt/gdt.controller";

export default async function (
  fastify: FastifyInstance
) {
  fastify.get("/captcha", captcha);
  fastify.post("/login", login);
  fastify.get("/invoices/purchase", purchaseInvoices);
  fastify.get("/invoices/sold", soldInvoices);
}
