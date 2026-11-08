// The sign-in code email. Kept short and plain on purpose: one code, a line of text, a small logo,
// and a plain-text copy. Spam filters trust that far more than a big image-heavy layout.

const LOGO = "https://budget-goblin.vercel.app/email/logo.png";

export function codeEmail(code) {
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const subject = `${spaced} is your BudGet code`;
  const text = [
    `Your BudGet sign-in code is ${spaced}`,
    "",
    "Type it in the BudGet app. It works for 10 minutes.",
    "",
    "Didn't ask for this? Ignore this email. Nobody can sign in without the code.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#F7F1EA;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F7F1EA" style="background:#F7F1EA;">
<tr><td align="center" style="padding:32px 16px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#3B3D4A;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td valign="middle"><img src="${LOGO}" width="40" height="40" alt="" style="display:block;border:0;border-radius:10px;"></td>
    <td valign="middle" style="padding-left:10px;font-size:26px;font-weight:800;color:#3B3D4A;">BudGet</td>
  </tr></table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="max-width:420px;margin-top:20px;background:#FFFFFF;border:2px solid #E8E2DC;border-radius:20px;">
  <tr><td align="center" style="padding:28px 24px;">
    <p style="margin:0 0 6px;font-size:16px;font-weight:700;">Your sign-in code</p>
    <p style="margin:0 0 16px;font-size:14px;color:#6B6E7B;">Type it in the BudGet app. It works for 10 minutes.</p>
    <p style="margin:0;font-size:36px;font-weight:800;letter-spacing:6px;color:#3B3D4A;">${spaced}</p>
  </td></tr>
  </table>
  <p style="max-width:420px;margin:16px 0 0;font-size:12px;color:#8A8D99;">Didn't ask for this? Ignore this email. Nobody can sign in without the code.</p>
</td></tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}
