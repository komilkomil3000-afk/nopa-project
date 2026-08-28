import 'package:flutter/material.dart';

enum ProfileLevel {
  newcomer, // تازه وارد
  general,  // عمومی
  bronze,   // برنزی
  silver,   // نقره‌ای
  golden,   // طلایی
}

class GlobalState {
  static ProfileLevel memberLevel = ProfileLevel.newcomer;
  static ProfileLevel mentorLevel = ProfileLevel.golden; // Mentors start at Golden or whatever they choose

  static int zarik = 12500;
  static int nakh = 450;
  static int beyragh = 12;
  static int farsh = 3;

  static List<Map<String, dynamic>> challenges = [
    {
      'id': 'c1',
      'title': 'چالش هدف‌گذاری SMART',
      'desc': 'اهداف شخصی خود را در سه حوزه طبق الگوی پنجگانه SMART بنویسید.',
      'reward': 200,
      'type': 'text', // text, multiple_choice, file
      'status': 'active', // active, archived_pending, archived_completed
      'submissionText': '',
      'attachedFile': null,
      'options': <String>[],
    },
    {
      'id': 'c2',
      'title': 'آزمون مرحله‌ای رسانه و تفکر',
      'desc': 'آزمون ۳ مرحله‌ای برای سنجش معلومات رسانه‌ای شما.',
      'reward': 250,
      'type': 'step_by_step_quiz',
      'status': 'active',
      'questions': [
        {
          'q': 'منظور از تفکر SMART چیست؟',
          'options': [
            'مشخص، قابل اندازه‌گیری، دستیابی، مرتبط، زمان‌دار',
            'ساده، مهم، دقیق، اصولی، سریع',
            'هیچکدام'
          ],
          'correct': 0,
        },
        {
          'q': 'مهم‌ترین اصل در نگارش سناریوی جذاب رسانه‌ای چیست؟',
          'options': [
            'پایان غافلگیرکننده',
            'قلاب ۳ ثانیه اول ویدیو',
            'طولانی بودن متن سناریو'
          ],
          'correct': 1,
        },
        {
          'q': 'کدام گزینه نشان‌دهنده یک هدف زمان‌دار است؟',
          'options': [
            'ثبت‌نام در یک کلاس مهارتی',
            'یادگیری انگلیسی تا پایان آذرماه',
            'تلاش مستمر برای ارتقای معدل'
          ],
          'correct': 1,
        }
      ],
      'answers': [-1, -1, -1],
    },
    {
      'id': 'c3',
      'title': 'چالش اولین بیرق کاروان',
      'desc': 'یک گزارش متنی از اولین جلسه همفکری با هم‌گروهی‌های خود ارسال کنید.',
      'reward': 300,
      'type': 'text',
      'status': 'archived_completed',
      'submissionText': 'جلسه با موفقیت در تاریخ ۲ مرداد برگزار شد.',
      'attachedFile': null,
      'options': <String>[],
    }
  ];

  static List<Map<String, dynamic>> tickets = [
    {
      'id': 't1',
      'sender': 'کمیل محمدی',
      'message': 'سوالی درباره نحوه طراحی اهداف زمان‌دار داشتم. آیا اهداف مهارتی هم باید در حوزه دوم نوشته شوند؟',
      'teacher': 'استاد: علوی',
      'status': 'pending', // pending, answered
      'answer': '',
      'rating': 0, // 0 to 5 stars
    }
  ];

  static Map<String, int> unlockedClipsPerClass = {};
  static Map<String, bool> completedClasses = {};

  static ProfileLevel getLevelForFrame(int frame) {
    if (frame <= 1) return ProfileLevel.newcomer;
    if (frame <= 4) return ProfileLevel.general;
    if (frame <= 7) return ProfileLevel.bronze;
    if (frame <= 10) return ProfileLevel.silver;
    return ProfileLevel.golden;
  }

  // Level display helper
  static String getLevelLabel(ProfileLevel level) {
    switch (level) {
      case ProfileLevel.newcomer:
        return 'تازه وارد';
      case ProfileLevel.general:
        return 'عمومی';
      case ProfileLevel.bronze:
        return 'برنزی';
      case ProfileLevel.silver:
        return 'نقره‌ای';
      case ProfileLevel.golden:
        return 'طلایی';
    }
  }

  static Color getLevelColor(ProfileLevel level) {
    switch (level) {
      case ProfileLevel.newcomer:
        return Colors.grey;
      case ProfileLevel.general:
        return Colors.blue;
      case ProfileLevel.bronze:
        return const Color(0xFFCD7F32); // Bronze
      case ProfileLevel.silver:
        return const Color(0xFFC0C0C0); // Silver
      case ProfileLevel.golden:
        return const Color(0xFFFFD700); // Gold
    }
  }

  static List<BoxShadow> getLevelGlow(ProfileLevel level) {
    if (level == ProfileLevel.newcomer) return [];
    return [
      BoxShadow(
        color: getLevelColor(level).withValues(alpha: 0.5),
        blurRadius: 12,
        spreadRadius: 2,
      )
    ];
  }
}
