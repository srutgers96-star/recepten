// Voice-command grammar + pickSpoken (docs/phase-5-spec.md Block B).
import { describe, expect, it } from 'vitest';
import { parseVoiceCommand, pickSpoken, type VoiceCommand } from '../src/domain/voice';

function cmd(transcript: string, lang: 'nl' | 'en'): VoiceCommand | null {
  return parseVoiceCommand(transcript, lang);
}

describe('parseVoiceCommand — navigation and reading', () => {
  it('recognises next in both languages', () => {
    expect(cmd('volgende', 'nl')).toEqual({ kind: 'next' });
    expect(cmd('Volgende!', 'nl')).toEqual({ kind: 'next' });
    expect(cmd('ga maar naar de volgende stap', 'nl')).toEqual({ kind: 'next' });
    expect(cmd('next', 'en')).toEqual({ kind: 'next' });
    expect(cmd('Next step, please.', 'en')).toEqual({ kind: 'next' });
  });

  it('recognises prev in both languages', () => {
    expect(cmd('vorige', 'nl')).toEqual({ kind: 'prev' });
    expect(cmd('ga even terug', 'nl')).toEqual({ kind: 'prev' });
    expect(cmd('previous', 'en')).toEqual({ kind: 'prev' });
    expect(cmd('go back', 'en')).toEqual({ kind: 'prev' });
  });

  it('recognises read in both languages', () => {
    expect(cmd('lees voor', 'nl')).toEqual({ kind: 'read' });
    expect(cmd('voorlezen', 'nl')).toEqual({ kind: 'read' });
    expect(cmd('lees', 'nl')).toEqual({ kind: 'read' });
    expect(cmd('read', 'en')).toEqual({ kind: 'read' });
    expect(cmd('read aloud', 'en')).toEqual({ kind: 'read' });
    expect(cmd('could you read that aloud', 'en')).toEqual({ kind: 'read' });
  });

  it('recognises stop in both languages', () => {
    expect(cmd('stop', 'nl')).toEqual({ kind: 'stop' });
    expect(cmd('Stop.', 'en')).toEqual({ kind: 'stop' });
    expect(cmd('stop maar even', 'nl')).toEqual({ kind: 'stop' });
  });

  it("'terug'/'back' need a go-word: recipe steps and kitchen talk say them all the time", () => {
    expect(cmd('ga terug', 'nl')).toEqual({ kind: 'prev' });
    expect(cmd('ga maar terug', 'nl')).toEqual({ kind: 'prev' });
    expect(cmd('go back', 'en')).toEqual({ kind: 'prev' });
    expect(cmd('zet de pan terug', 'nl')).toBeNull();
    expect(cmd('doe de kip terug in de pan', 'nl')).toBeNull();
    expect(cmd('put the pan back on a low heat', 'en')).toBeNull();
    expect(cmd('bring back to the boil', 'en')).toBeNull();
  });

  it('matches whole words only', () => {
    expect(cmd('het stopcontact zit achter de kast', 'nl')).toBeNull();
    expect(cmd('onomatopee', 'nl')).toBeNull(); // no "stop" inside another word either
    expect(cmd('de teruggave', 'nl')).toBeNull();
    expect(cmd('my backpack', 'en')).toBeNull();
    expect(cmd('leest', 'nl')).toBeNull();
  });

  it('commands are language-specific (except stop)', () => {
    expect(cmd('volgende', 'en')).toBeNull();
    expect(cmd('next', 'nl')).toBeNull();
  });

  it('takes the first clear command', () => {
    expect(cmd('volgende en dan stop', 'nl')).toEqual({ kind: 'next' });
    expect(cmd('stop stop volgende', 'nl')).toEqual({ kind: 'stop' });
    expect(cmd('read the next step', 'en')).toEqual({ kind: 'read' });
  });

  it('returns null when nothing matches', () => {
    expect(cmd('', 'nl')).toBeNull();
    expect(cmd('   ', 'en')).toBeNull();
    expect(cmd('wat een lekker recept is dit', 'nl')).toBeNull();
    expect(cmd('this smells delicious', 'en')).toBeNull();
  });
});

describe('parseVoiceCommand — timer', () => {
  it('parses digits (NL)', () => {
    expect(cmd('timer 10 minuten', 'nl')).toEqual({ kind: 'timer', minutes: 10 });
    expect(cmd('timer 10', 'nl')).toEqual({ kind: 'timer', minutes: 10 });
    expect(cmd('zet een timer voor 5 minuten', 'nl')).toEqual({ kind: 'timer', minutes: 5 });
  });

  it('parses digits (EN)', () => {
    expect(cmd('timer 10 minutes', 'en')).toEqual({ kind: 'timer', minutes: 10 });
    expect(cmd('set a timer for 10 minutes', 'en')).toEqual({ kind: 'timer', minutes: 10 });
    expect(cmd('Set a timer for 12 minutes, please.', 'en')).toEqual({ kind: 'timer', minutes: 12 });
  });

  it('parses Dutch number words 1-20 plus 30/45/60', () => {
    expect(cmd('timer een minuut', 'nl')).toEqual({ kind: 'timer', minutes: 1 });
    expect(cmd('timer vijf minuten', 'nl')).toEqual({ kind: 'timer', minutes: 5 });
    expect(cmd('zet een timer van tien minuten', 'nl')).toEqual({ kind: 'timer', minutes: 10 });
    expect(cmd('timer twintig minuten', 'nl')).toEqual({ kind: 'timer', minutes: 20 });
    expect(cmd('timer dertig minuten', 'nl')).toEqual({ kind: 'timer', minutes: 30 });
    expect(cmd('timer vijfenveertig minuten', 'nl')).toEqual({ kind: 'timer', minutes: 45 });
    expect(cmd('timer zestig minuten', 'nl')).toEqual({ kind: 'timer', minutes: 60 });
  });

  it('parses English number words 1-20 plus 30/45/60', () => {
    expect(cmd('set a timer for five minutes', 'en')).toEqual({ kind: 'timer', minutes: 5 });
    expect(cmd('timer fifteen', 'en')).toEqual({ kind: 'timer', minutes: 15 });
    expect(cmd('timer twenty minutes', 'en')).toEqual({ kind: 'timer', minutes: 20 });
    expect(cmd('timer thirty minutes', 'en')).toEqual({ kind: 'timer', minutes: 30 });
    expect(cmd('set a timer for forty-five minutes', 'en')).toEqual({ kind: 'timer', minutes: 45 });
    expect(cmd('timer forty five minutes', 'en')).toEqual({ kind: 'timer', minutes: 45 });
    expect(cmd('timer sixty minutes', 'en')).toEqual({ kind: 'timer', minutes: 60 });
  });

  it('clamps to 1-180 minutes', () => {
    expect(cmd('timer 500 minuten', 'nl')).toEqual({ kind: 'timer', minutes: 180 });
    expect(cmd('timer 0', 'en')).toEqual({ kind: 'timer', minutes: 1 });
  });

  it('understands hours', () => {
    expect(cmd('timer 2 uur', 'nl')).toEqual({ kind: 'timer', minutes: 120 });
    expect(cmd('timer een uur', 'nl')).toEqual({ kind: 'timer', minutes: 60 });
    expect(cmd('set a timer for an hour', 'en')).toEqual({ kind: 'timer', minutes: 60 });
    expect(cmd('timer 4 uur', 'nl')).toEqual({ kind: 'timer', minutes: 180 }); // clamped
  });

  it('understands half an hour and a quarter of an hour', () => {
    expect(cmd('timer een half uur', 'nl')).toEqual({ kind: 'timer', minutes: 30 });
    expect(cmd('set a timer for half an hour', 'en')).toEqual({ kind: 'timer', minutes: 30 });
    expect(cmd('zet een timer voor een kwartier', 'nl')).toEqual({ kind: 'timer', minutes: 15 });
    expect(cmd('timer for a quarter of an hour', 'en')).toEqual({ kind: 'timer', minutes: 15 });
  });

  it('accepts the duration before the word timer', () => {
    expect(cmd('set a ten minute timer', 'en')).toEqual({ kind: 'timer', minutes: 10 });
    expect(cmd('10 minuten timer', 'nl')).toEqual({ kind: 'timer', minutes: 10 });
  });

  it('timer without a duration is not a command', () => {
    expect(cmd('timer', 'nl')).toBeNull();
    expect(cmd('zet een timer', 'nl')).toBeNull();
    expect(cmd('de timer stop', 'nl')).toEqual({ kind: 'stop' }); // falls through to stop
    expect(cmd('stop de timer', 'nl')).toEqual({ kind: 'stop' });
  });
});

describe('pickSpoken', () => {
  it('prefers the asked language', () => {
    expect(pickSpoken({ nl: 'Kook de pasta.', en: 'Cook the pasta.' }, 'nl')).toEqual({
      text: 'Kook de pasta.',
      lang: 'nl',
    });
    expect(pickSpoken({ nl: 'Kook de pasta.', en: 'Cook the pasta.' }, 'en')).toEqual({
      text: 'Cook the pasta.',
      lang: 'en',
    });
  });

  it('falls back to the other language and says so', () => {
    expect(pickSpoken({ nl: 'Kook de pasta.' }, 'en')).toEqual({ text: 'Kook de pasta.', lang: 'nl' });
    expect(pickSpoken({ en: 'Cook the pasta.' }, 'nl')).toEqual({ text: 'Cook the pasta.', lang: 'en' });
    expect(pickSpoken({ nl: '   ', en: 'Cook the pasta.' }, 'nl')).toEqual({
      text: 'Cook the pasta.',
      lang: 'en',
    });
  });

  it('empty text keeps the preferred language', () => {
    expect(pickSpoken(null, 'nl')).toEqual({ text: '', lang: 'nl' });
    expect(pickSpoken(undefined, 'en')).toEqual({ text: '', lang: 'en' });
    expect(pickSpoken({}, 'nl')).toEqual({ text: '', lang: 'nl' });
    expect(pickSpoken({ nl: '', en: ' ' }, 'en')).toEqual({ text: '', lang: 'en' });
  });
});
