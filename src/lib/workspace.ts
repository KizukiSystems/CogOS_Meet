import { getAccessToken } from './firebase';

export async function createDriveFile(title: string, content: string) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const metadata = {
    name: title,
    mimeType: 'text/plain',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'text/plain' }));

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: form
  });

  if (!res.ok) {
    throw new Error('Failed to create Drive file');
  }

  return res.json();
}

export async function sendEmail(to: string, subject: string, bodyText: string) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const message = [
    `To: ${to}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    bodyText
  ].join('\\r\\n');

  // base64url encode
  const encodedMessage = btoa(unescape(encodeURIComponent(message)))
    .replace(/\\+/g, '-')
    .replace(/\\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      raw: encodedMessage
    })
  });

  if (!res.ok) {
    throw new Error('Failed to send email');
  }

  return res.json();
}

export async function appendToTrackerSheet(meetingTitle: string, date: string, summary: string) {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  let spreadsheetId = localStorage.getItem('cogmeet_tracker_sheet_id');

  if (!spreadsheetId) {
    // Create new sheet
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: 'CogMeet Tracker'
        },
        sheets: [
          {
            properties: {
              title: 'Meetings'
            }
          }
        ]
      })
    });

    if (!createRes.ok) throw new Error('Failed to create spreadsheet');
    const sheetData = await createRes.json();
    spreadsheetId = sheetData.spreadsheetId;
    
    // Add headers
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Meetings!A1:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: [
          ['Date', 'Title', 'Summary']
        ]
      })
    });
    
    if (spreadsheetId) {
      localStorage.setItem('cogmeet_tracker_sheet_id', spreadsheetId);
    }
  }

  // Append row
  const appendRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Meetings!A1:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [
        [date, meetingTitle, summary]
      ]
    })
  });

  if (!appendRes.ok) {
    throw new Error('Failed to append to spreadsheet');
  }

  return appendRes.json();
}
