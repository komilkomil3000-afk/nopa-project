// Mentors (and super mentors) can browse all LMS content but never earn personal rewards.
export function isMentorRole(role?: string | null): boolean {
  const r = String(role || '').toLowerCase().replace(/[\s_-]/g, '');
  return r === 'mentor' || r === 'supermentor';
}

/**
 * The user levels:
 *   admin      - super admin, unrestricted in the panel (can change roles and grant access)
 *   sub_admin  - content admin, limited to the panel sections a super admin granted
 *   channel_manager - runs the channels and helps keep the groups in order; can reach chat and nothing else
 *   support    - answers support conversations and helps every caravan, one caravan at a time; chat only
 *   mentor     - mentor (legacy value SUPER_MENTOR is treated as a mentor)
 *   student
 */
export const ROLE_ADMIN = 'admin';
export const ROLE_SUB_ADMIN = 'sub_admin';
export const ROLE_CHANNEL_MANAGER = 'channel_manager';
export const ROLE_SUPPORT = 'support';
export const ROLE_MENTOR = 'mentor';
export const ROLE_STUDENT = 'student';

/** Roles a super admin may assign from the panel. */
export const ASSIGNABLE_ROLES = [ROLE_ADMIN, ROLE_SUB_ADMIN, ROLE_CHANNEL_MANAGER, ROLE_SUPPORT, ROLE_MENTOR, ROLE_STUDENT];

/** Staff roles only a super admin may create or assign. */
export const SUPER_ADMIN_ONLY_ROLES = [ROLE_ADMIN, ROLE_SUB_ADMIN, ROLE_CHANNEL_MANAGER, ROLE_SUPPORT];

export function isSuperAdminRole(role?: string | null): boolean {
  return String(role || '').toLowerCase() === ROLE_ADMIN;
}

export function isSubAdminRole(role?: string | null): boolean {
  return String(role || '').toLowerCase().replace(/[\s-]/g, '_') === ROLE_SUB_ADMIN;
}

export function isChannelManagerRole(role?: string | null): boolean {
  return String(role || '').toLowerCase().replace(/[\s-]/g, '_') === ROLE_CHANNEL_MANAGER;
}

export function isSupportRole(role?: string | null): boolean {
  return String(role || '').toLowerCase().trim() === ROLE_SUPPORT;
}

/** The only API areas a support user can call, relative to /api/v1: the chat and their own account. */
export function supportMayCall(path: string): boolean {
  return /^\/(auth\/|users\/me(\/|$)|notifications(\/|$)|assets$|chat(\/|$))/i.test(path);
}

/**
 * The only API areas a channel manager can call, relative to /api/v1. The /admin router has its
 * own, stricter gate. Hiding screens in the app is not enough: this closes the API itself.
 */
export function channelManagerMayCall(path: string): boolean {
  return /^\/(auth\/|users\/me(\/|$)|notifications(\/|$)|assets$|chat(\/|$)|admin(\/|$))/i.test(path);
}

export const CHAT_PERMISSION_LABELS = {
  publishChannels: 'انتشار و زمان‌بندی محتوا در کانال‌های اصلی',
  enterGroups: 'ورود به گروه‌ها',
  moderate: 'سنجاق، حالت کند، حذف پیام و بی‌صدای موقت',
  publicTags: 'ساخت تگ عمومی',
  useBots: 'استفاده از ربات‌ها',
  export: 'خروجی گرفتن',
  privateChats: 'مشاهده‌ی پیام‌های خصوصی و پرونده‌های پشتیبانی',
};
export type ChatPermissions = Record<keyof typeof CHAT_PERMISSION_LABELS, boolean>;

export const DEFAULT_CHAT_PERMISSIONS: ChatPermissions = {
  publishChannels: true,
  enterGroups: true,
  moderate: true,
  publicTags: true,
  useBots: true,
  export: false,
  privateChats: false,
};

/** Reads a channel manager's access from RolePermission.permissionsJson. Never throws. */
export function parseChatPermissions(raw?: string | null): ChatPermissions {
  const out = { ...DEFAULT_CHAT_PERMISSIONS };
  try {
    const chat = JSON.parse(raw || '{}')?.chat;
    if (chat && typeof chat === 'object') {
      for (const key of Object.keys(out) as (keyof ChatPermissions)[]) {
        if (typeof chat[key] === 'boolean') out[key] = chat[key];
      }
    }
  } catch {
    // Damaged JSON falls back to the defaults
  }
  return out;
}

/** Panel sections a super admin can grant to a sub admin. */
export const PANEL_SECTIONS: Record<string, string> = {
  users: 'کاربران، مخاطبان و سطوح',
  rewards: 'کیف پول، زریک و دارایی‌ها',
  mentors: 'راهبران و مدارک',
  instructors: 'بانک اساتید',
  caravans: 'کاروان‌ها',
  lms: 'منزلگاه‌ها، کلاس‌ها و آزمون‌ها',
  challenges: 'چالش‌ها و تکالیف',
  support: 'تیکت‌ها، پیام‌ها و چت',
  chat: 'مدیریت چت و کانال‌ها',
  content: 'جارچی، بنر، رسانه و فرم‌ها',
  notifications: 'اعلان‌ها و پیام‌رسانی',
  analytics: 'آمار و لیگ',
};

export type SectionLevel = 'view' | 'edit';
export type SectionGrants = Record<string, SectionLevel>;

/** Parses RolePermission.permissionsJson, dropping unknown sections/levels. Never throws. */
export function parseSectionGrants(raw?: string | null): SectionGrants {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    const out: SectionGrants = {};
    if (parsed && typeof parsed === 'object') {
      for (const [key, level] of Object.entries(parsed)) {
        if (key in PANEL_SECTIONS && (level === 'view' || level === 'edit')) {
          out[key] = level as SectionLevel;
        }
      }
    }
    return out;
  } catch {
    return {};
  }
}
