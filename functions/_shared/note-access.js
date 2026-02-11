const { normalizeEmail } = require('./auth');

function listContainsEmail(list, email) {
  if (!Array.isArray(list) || !email) return false;
  const normalized = normalizeEmail(email);

  for (const item of list) {
    if (typeof item === 'string') {
      if (normalizeEmail(item) === normalized) return true;
      continue;
    }

    if (item && typeof item === 'object') {
      if (normalizeEmail(item.email) === normalized) return true;
    }
  }

  return false;
}

function canUserAccessNote(note, userEmail) {
  if (!note || !userEmail) return false;
  const email = normalizeEmail(userEmail);
  if (!email) return false;

  if (normalizeEmail(note.meeting?.organizer) === email) return true;
  if (listContainsEmail(note.meeting?.attendee_emails, email)) return true;
  if (listContainsEmail(note.meeting?.attendees, email)) return true;
  if (listContainsEmail(note.sharing?.shared_with, email)) return true;

  return false;
}

module.exports = {
  canUserAccessNote,
  listContainsEmail,
};
