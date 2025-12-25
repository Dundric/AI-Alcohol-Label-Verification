import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from "@azure/functions";
import { extractLabelFromFormData } from "../lib/extractLabel";

const loggerFromContext = (context: InvocationContext) => ({
  log: (...args: unknown[]) => context.log(...args),
  warn: (...args: unknown[]) => context.log(...args),
  error: (...args: unknown[]) => context.log(...args),
});

export async function verifyImage(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const formData = await request.formData();
    const result = await extractLabelFromFormData(formData, {
      logger: loggerFromContext(context),
    });

    if (!result.ok) {
      return {
        status: result.status,
        jsonBody: { error: result.error },
      };
    }

    return {
      status: 200,
      jsonBody: { label: result.label, evaluation: result.evaluation },
    };
  } catch (error) {
    context.log("verifyImage error", error);
    return { status: 500, jsonBody: { error: "Internal Server Error" } };
  }
}

app.http("verifyImage", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: verifyImage,
});
