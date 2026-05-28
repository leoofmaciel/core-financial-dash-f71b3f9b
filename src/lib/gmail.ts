export async function sendGmail(accessToken: string, to: string, subject: string, text: string, attachments?: { name: string, dataUrl: string }[]) {
  // Construct the email MIME message
  const boundary = `====boundary_${Date.now()}====`;
  
  let emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    text,
    ``,
  ];

  if (attachments) {
    for (const att of attachments) {
      // dataUrl format: "data:application/pdf;filename=generated.pdf;base64,JVBERi0xLjQK..."
      const [meta, base64] = att.dataUrl.split(",");
      const mimeMatch = meta.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*;/);
      const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
      
      emailLines.push(
        `--${boundary}`,
        `Content-Type: ${mimeType}; name="${att.name}"`,
        `Content-Disposition: attachment; filename="${att.name}"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        base64,
        ``
      );
    }
  }

  emailLines.push(`--${boundary}--`);
  
  const rawEmail = emailLines.join('\r\n');
  const encodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch("https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: encodedEmail,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Failed to send email via Gmail API");
  }

  return await response.json();
}
