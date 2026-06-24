declare module 'nodemailer' {
  interface TransportOptions {
    service?: string;
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user: string; pass: string };
    [key: string]: any;
  }

  interface MailOptions {
    from?: string;
    to?: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    [key: string]: any;
  }

  interface Transporter {
    sendMail(options: MailOptions): Promise<any>;
    verify(): Promise<any>;
  }

  export function createTransport(options: TransportOptions | string): Transporter;
  const nodemailer: { createTransport: typeof createTransport };
  export default nodemailer;
}
