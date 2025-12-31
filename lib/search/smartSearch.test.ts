import { describe, it, expect } from 'vitest';
import {
  removeDiacritics,
  normalizeForSearch,
  normalizeCompact,
  smartMatch,
  smartMatchStation,
} from './smartSearch';

describe('removeDiacritics', () => {
  it('removes Czech diacritics', () => {
    expect(removeDiacritics('Střížkov')).toBe('Strizkov');
    expect(removeDiacritics('Žďár nad Sázavou')).toBe('Zdar nad Sazavou');
    expect(removeDiacritics('Ústí nad Labem')).toBe('Usti nad Labem');
  });

  it('removes German diacritics', () => {
    expect(removeDiacritics('Würzburg')).toBe('Wurzburg');
    expect(removeDiacritics('München')).toBe('Munchen');
    expect(removeDiacritics('Köln')).toBe('Koln');
  });

  it('removes Hungarian diacritics', () => {
    expect(removeDiacritics('Győr')).toBe('Gyor');
    expect(removeDiacritics('Székesfehérvár')).toBe('Szekesfehervar');
  });

  it('keeps plain ASCII unchanged', () => {
    expect(removeDiacritics('Praha')).toBe('Praha');
    expect(removeDiacritics('Berlin')).toBe('Berlin');
  });
});

describe('normalizeForSearch', () => {
  it('lowercases and removes diacritics', () => {
    expect(normalizeForSearch('Praha Hlavní Nádraží')).toBe('praha hlavni nadrazi');
    expect(normalizeForSearch('OSTRAVA')).toBe('ostrava');
  });

  it('trims whitespace', () => {
    expect(normalizeForSearch('  Praha  ')).toBe('praha');
  });
});

describe('normalizeCompact', () => {
  it('removes spaces and dashes', () => {
    expect(normalizeCompact('Praha hlavní nádraží')).toBe('prahahlavninadrazi');
    expect(normalizeCompact('Ústí nad Labem-západ')).toBe('ustinadlabemzapad');
  });
});

describe('smartMatch', () => {
  describe('simple contains matching', () => {
    it('matches substring', () => {
      expect(smartMatch('prah', 'Praha hlavní nádraží')).toBe(true);
      expect(smartMatch('hlavní', 'Praha hlavní nádraží')).toBe(true);
    });

    it('is case insensitive', () => {
      expect(smartMatch('PRAHA', 'Praha hlavní nádraží')).toBe(true);
      expect(smartMatch('Praha', 'PRAHA HLAVNÍ NÁDRAŽÍ')).toBe(true);
    });

    it('ignores diacritics in query', () => {
      expect(smartMatch('nadrazi', 'Praha hlavní nádraží')).toBe(true);
      expect(smartMatch('hlavni', 'Praha hlavní nádraží')).toBe(true);
    });

    it('ignores diacritics in text', () => {
      expect(smartMatch('nádraží', 'Praha hlavni nadrazi')).toBe(true);
    });
  });

  describe('compact matching (ignoring spaces/dashes)', () => {
    it('matches across word boundaries', () => {
      expect(smartMatch('prahahl', 'Praha hlavní nádraží')).toBe(true);
      expect(smartMatch('ustinad', 'Ústí nad Labem')).toBe(true);
    });

    it('ignores dashes', () => {
      expect(smartMatch('labemzapad', 'Ústí nad Labem-západ')).toBe(true);
    });
  });

  describe('shortcut matching', () => {
    it('matches word starts with spaces', () => {
      expect(smartMatch('s n o', 'Suchdol nad Odrou')).toBe(true);
      expect(smartMatch('p h n', 'Praha hlavní nádraží')).toBe(true);
    });

    it('matches partial word starts', () => {
      expect(smartMatch('such nad', 'Suchdol nad Odrou')).toBe(true);
      expect(smartMatch('pra hla', 'Praha hlavní nádraží')).toBe(true);
    });

    it('matches with skipped words', () => {
      expect(smartMatch('praha nadrazi', 'Praha hlavní nádraží')).toBe(true);
    });

    it('respects word order', () => {
      // "nadrazi praha" should NOT match because order is wrong
      expect(smartMatch('nadrazi praha', 'Praha hlavní nádraží')).toBe(false);
    });

    it('handles single letter shortcuts', () => {
      expect(smartMatch('b k', 'Budapest Keleti')).toBe(true);
      expect(smartMatch('u n l', 'Ústí nad Labem')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('empty query matches everything', () => {
      expect(smartMatch('', 'Praha')).toBe(true);
      expect(smartMatch('   ', 'Praha')).toBe(true);
    });

    it('empty text matches nothing (except empty query)', () => {
      expect(smartMatch('', '')).toBe(true);
      expect(smartMatch('a', '')).toBe(false);
    });
  });
});

describe('smartMatchStation', () => {
  const station = { name: 'Praha hlavní nádraží', code: 'PHN' };

  it('matches by name', () => {
    expect(smartMatchStation('praha', station)).toBe(true);
    expect(smartMatchStation('p h n', station)).toBe(true);
  });

  it('matches by code', () => {
    expect(smartMatchStation('phn', station)).toBe(true);
    expect(smartMatchStation('PH', station)).toBe(true);
  });

  it('empty query matches', () => {
    expect(smartMatchStation('', station)).toBe(true);
  });

  it('non-matching query returns false', () => {
    expect(smartMatchStation('berlin', station)).toBe(false);
  });
});
