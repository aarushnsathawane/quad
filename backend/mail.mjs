import nodemailer from 'nodemailer';
export function createMailer(config) {
  const { smtp } = config;
  const transport = smtp.host
    ? nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        requireTLS: !smtp.secure,
        auth: { user: smtp.user, pass: smtp.password },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      })
    : null;
  const send = async (email, code) => {
    if (!transport) throw new Error('Email delivery has not been configured');
    await transport.sendMail({
      from: smtp.from,
      to: email,
      subject: 'Your Quad sign-in code',
      text: `Your Quad code is ${code}. It expires in 10 minutes. Do not share it. If you did not request this code, ignore this message.`,
    });
  };
  send.notify = async () => {
    if (!transport) throw new Error('Email delivery has not been configured');
    await transport.sendMail({
      from: smtp.from,
      to: config.adminEmails,
      subject: 'Quad safety report needs review',
      text: `A new report is waiting in Quad. Sign in with your moderator account at ${config.origin} and open Profile → Moderation. Report details are available only inside the protected queue.`,
    });
  };
  return send;
}
