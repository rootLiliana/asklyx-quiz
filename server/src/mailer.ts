import { createTransport } from "nodemailer";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

// Sin SMTP configurado (desarrollo local) el correo solo se imprime en
// consola, para poder copiar el enlace de recuperación sin un servidor real.
class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    console.log(`📧 [correo no enviado: SMTP_HOST no configurado] Para: ${message.to}\n${message.subject}\n${message.text}`);
  }
}

class SmtpMailer implements Mailer {
  private readonly transport;

  constructor(private readonly from: string) {
    const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);

    this.transport = createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? "" }
        : undefined,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...message });
  }
}

export function createMailer(): Mailer {
  const host = process.env.SMTP_HOST?.trim();

  if (!host) {
    return new ConsoleMailer();
  }

  const from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || "no-reply@lilihoot.app";
  return new SmtpMailer(from);
}
