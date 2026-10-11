import { db } from '../db';

export interface PronunciationRule {
  id: string;
  pattern: string; // e.g. "ko", "vk", "ck", "main"
  replacement: string; // e.g. "không", "vợ", "chồng", "nhân vật chính"
  isRegex?: boolean;
  caseSensitive?: boolean;
  enabled: boolean;
}

export const DEFAULT_PRONUNCIATION_RULES: PronunciationRule[] = [
  { id: '1', pattern: '\\bko\\b', replacement: 'không', isRegex: true, enabled: true },
  { id: '2', pattern: '\\bkhg\\b', replacement: 'không', isRegex: true, enabled: true },
  { id: '3', pattern: '\\bvk\\b', replacement: 'vợ', isRegex: true, enabled: true },
  { id: '4', pattern: '\\bck\\b', replacement: 'chồng', isRegex: true, enabled: true },
  { id: '5', pattern: '\\bmain\\b', replacement: 'nhân vật chính', isRegex: true, enabled: true },
  { id: '6', pattern: '\\bdrop\\b', replacement: 'bỏ dở', isRegex: true, enabled: true },
  { id: '7', pattern: '\\bvs\\b', replacement: 'với', isRegex: true, enabled: true },
  { id: '8', pattern: '\\bdc\\b', replacement: 'được', isRegex: true, enabled: true },
  { id: '9', pattern: '\\bđc\\b', replacement: 'được', isRegex: true, enabled: true },
  { id: '10', pattern: '\\bkt\\b', replacement: 'kiểm tra', isRegex: true, enabled: true },
  { id: '11', pattern: '\\bbthg\\b', replacement: 'bình thường', isRegex: true, enabled: true },
  { id: '12', pattern: '\\bmn\\b', replacement: 'mọi người', isRegex: true, enabled: true },
  { id: '13', pattern: '\\bntn\\b', replacement: 'như thế nào', isRegex: true, enabled: true },
  { id: '14', pattern: '\\bj\\b', replacement: 'gì', isRegex: true, enabled: true },
  { id: '15', pattern: '\\bh\\b', replacement: 'giờ', isRegex: true, enabled: true }
];

class PronunciationService {
  private rules: PronunciationRule[] = DEFAULT_PRONUNCIATION_RULES;
  private hasLoaded = false;

  public async init(): Promise<PronunciationRule[]> {
    if (this.hasLoaded) return this.rules;
    const saved = await db.getSetting<PronunciationRule[]>('pronunciationRules', DEFAULT_PRONUNCIATION_RULES);
    this.rules = saved && saved.length > 0 ? saved : DEFAULT_PRONUNCIATION_RULES;
    this.hasLoaded = true;
    return this.rules;
  }

  public getRules(): PronunciationRule[] {
    return this.rules;
  }

  public async saveRule(rule: Omit<PronunciationRule, 'id'> & { id?: string }): Promise<PronunciationRule[]> {
    const id = rule.id || `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newRule: PronunciationRule = {
      id,
      pattern: rule.pattern.trim(),
      replacement: rule.replacement.trim(),
      isRegex: rule.isRegex ?? false,
      caseSensitive: rule.caseSensitive ?? false,
      enabled: rule.enabled ?? true
    };

    const existingIdx = this.rules.findIndex(r => r.id === id);
    if (existingIdx >= 0) {
      this.rules[existingIdx] = newRule;
    } else {
      this.rules.push(newRule);
    }

    await db.saveSetting('pronunciationRules', this.rules);
    return [...this.rules];
  }

  public async deleteRule(id: string): Promise<PronunciationRule[]> {
    this.rules = this.rules.filter(r => r.id !== id);
    await db.saveSetting('pronunciationRules', this.rules);
    return [...this.rules];
  }

  public async toggleRule(id: string): Promise<PronunciationRule[]> {
    this.rules = this.rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r);
    await db.saveSetting('pronunciationRules', this.rules);
    return [...this.rules];
  }

  public async resetDefaults(): Promise<PronunciationRule[]> {
    this.rules = [...DEFAULT_PRONUNCIATION_RULES];
    await db.saveSetting('pronunciationRules', this.rules);
    return this.rules;
  }

  /**
   * Replace words according to custom rules before speaking
   */
  public applyRules(text: string): string {
    if (!text || !this.rules || this.rules.length === 0) return text;
    let result = text;

    for (const rule of this.rules) {
      if (!rule.enabled || !rule.pattern) continue;
      try {
        if (rule.isRegex) {
          const flags = rule.caseSensitive ? 'g' : 'gi';
          const regex = new RegExp(rule.pattern, flags);
          result = result.replace(regex, rule.replacement);
        } else {
          // Plain exact word boundary replacement
          const escaped = rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const flags = rule.caseSensitive ? 'g' : 'gi';
          const regex = new RegExp(`\\b${escaped}\\b`, flags);
          result = result.replace(regex, rule.replacement);
        }
      } catch (e) {
        console.warn('Pronunciation rule regex error:', rule.pattern, e);
      }
    }

    return result;
  }
}

export const pronunciationService = new PronunciationService();
