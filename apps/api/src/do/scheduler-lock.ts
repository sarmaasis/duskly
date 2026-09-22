export class SchedulerLock implements DurableObject {
  constructor(private readonly ctx: DurableObjectState) {}
  async fetch(request: Request): Promise<Response> {
    const { action } = (await request.json()) as { action: "acquire" | "release" };
    const held = (await this.ctx.storage.get<string>("job")) ?? null;
    if (action === "acquire") {
      if (held && held !== request.headers.get("x-job-id")) {
        return Response.json({ ok: false, held }, { status: 409 });
      }
      const jobId = request.headers.get("x-job-id") ?? crypto.randomUUID();
      await this.ctx.storage.put("job", jobId);
      return Response.json({ ok: true, jobId });
    }
    await this.ctx.storage.delete("job");
    return Response.json({ ok: true });
  }
}
