type AuditEvent = {
  action: string;
  userId?: string | null;
  success: boolean;
  details?: Record<string, unknown>;
};

export const auditService = {
  log(event: AuditEvent): void {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), ...event }));
  },
};
