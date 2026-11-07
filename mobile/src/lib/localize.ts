import { phrase, t, tFitted } from './i18n';

// display.ts and board.ts are copies of the web console's logic (tests/mobile-contract.test.ts keeps them identical), so
// they return English. These lists tell the app how to show that English in the current language: each template is the
// text with its changing part as {name}. Listing a phrase here is also what puts it on the translators' list.

const STATUS = [
  phrase('Check the recording'),
  phrase('Accepted'),
  phrase('Accepted with a condition'),
  phrase('Declined'),
  phrase('Declined · {reason}'),
  phrase('Wants to talk to you'),
  phrase('Calling back at {time}'),
  phrase('Redirected'),
  phrase('Redirected to {number}'),
  phrase('Phone menu: add a direct number'),
  phrase('Bed held'),
  phrase('Bed no longer available'),
  phrase('Released'),
  phrase('Patient arrived'),
  phrase('Not arrived yet'),
  phrase('Queued'),
  phrase('Ringing'),
  phrase('On call · {time}'),
  phrase('No answer'),
  phrase('Busy'),
  phrase('Call failed'),
  phrase('Cancelled'),
];

const EVENTS = [
  phrase('Referral created'),
  phrase('Calling {count} hospitals (round {round})'),
  phrase('Calling {name} to confirm the bed'),
  phrase('{name} answered'),
  phrase('{name}: no answer'),
  phrase('{name}: busy'),
  phrase('{name}: call failed'),
  phrase('{name} accepted'),
  phrase('{name} accepted with a condition'),
  phrase('{name} declined'),
  phrase('{name} gave another number'),
  phrase('{name} answer unclear'),
  phrase('{name} reached a phone menu'),
  phrase('{name} wants to talk to you'),
  phrase('{name} asked for a callback'),
  phrase('First yes after {time}'),
  phrase('{name} wants to talk to you: {reason}'),
  phrase('{name} called back'),
  phrase('{name} called back: {message}'),
  phrase('{name} asked to be called back at {time}'),
  phrase('Calling {name} again ({reason})'),
  phrase('{name}: answer unclear (call says {call}, transcript says {transcript}). Check the recording'),
  phrase('You selected {name}'),
  phrase('{name} confirmed the bed'),
  phrase('{name} confirmed the bed · ask for {person}'),
  phrase('{name} can no longer take the patient'),
  phrase('WhatsApp to {who}: {status}'),
  phrase('Releasing {name}'),
  phrase('Asking {name} whether the patient has arrived'),
  phrase('{name} says the patient has arrived'),
  phrase('{name} says the patient has not arrived yet'),
  phrase('Hold expired'),
  phrase('No hospital accepted'),
  phrase('Referral cancelled'),
  phrase('Referral cancelled: {reason}'),
  phrase('Referral closed: {reason}'),
  phrase('{name}: desk said {outcome}, but {detail} ({source})'),
  phrase('WhatsApp bed request to {name}: {status}'),
  phrase('Family gave a missed call: calling them back with the update'),
  phrase('Calling the family with the update'),
  phrase('{name}: call status recovered from Bolna (missed webhook)'),
];

// Added to the end of a line when the doctor did it themselves; translated apart so the line before it still fits a template.
const ENDINGS = [phrase('(entered by doctor)'), phrase('(confirmed by phone)')];
const ENDING = /^(.*?) \((entered by doctor|confirmed by phone)\)$/;

// The words inside lines that the server sends in English: who a message went to, and what became of it.
/** The single words inside server lines that the app translates: who a message went to and what became of it. */
export const WORDS = [
  phrase('hospital'),
  phrase('you'),
  phrase('family'),
  phrase('sent'),
  phrase('delivered'),
  phrase('read'),
  phrase('failed'),
  phrase('queued'),
  phrase('not sent'),
  phrase('no answer'),
  phrase('busy'),
  phrase('accepted'),
  phrase('declined'),
  phrase('unclear'),
  phrase('arrived'),
  phrase('hold expired'),
  phrase('cancelled'),
  phrase('widened'),
];

/** The text of a hospital's status (`attemptDisplay(...).text`) in the current language. */
export const statusText = (text: string): string => tFitted(text, STATUS);

/** A line of the activity feed (`eventText(...)`) in the current language. */
export function eventLine(text: string): string {
  const ending = ENDING.exec(text);
  if (!ending?.[1]) return tFitted(text, EVENTS);
  return `${eventLine(ending[1])} ${t(`(${ending[2]})`)}`;
}

/** A word the server sends in English (a message status, a close reason), in the current language. */
export const wordText = (text: string): string => t(text);

/** The phrases the helpers above know, for the test that every one has a Hindi wording. */
export const LISTED = [...STATUS, ...EVENTS, ...ENDINGS, ...WORDS];
