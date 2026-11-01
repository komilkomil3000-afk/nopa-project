import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:nopa_app/models/user_model.dart';
import 'package:nopa_app/widgets/support_message_dialog.dart';

bool _isMentorRole(UserModel user) => user.role == UserRole.mentor || user.role == UserRole.superMentor;

/// Label of the "contact" button: a mentor has no mentor above them, so they write to the support team.
String contactMentorLabel(UserModel user) => _isMentorRole(user) ? 'پیام به پشتیبانی' : 'ارتباط با راهبر';

/// Builds the chat link for a mentor from the platform and ID stored in the database.
/// Returns null when the mentor has no usable ID.
Uri? buildMentorContactUri(String? platform, String? handle) {
  var id = (handle ?? '').trim();
  if (id.isEmpty) return null;

  if (id.startsWith('http://') || id.startsWith('https://')) {
    return Uri.tryParse(id);
  }

  final p = (platform ?? '').trim().toLowerCase();
  final bareId = id.startsWith('@') ? id.substring(1) : id;
  final digits = bareId.replaceAll(RegExp(r'[^0-9]'), '');
  final isPhone = RegExp(r'^\+?[0-9\s-]{8,}$').hasMatch(bareId);

  if (p.contains('ایتا') || p.contains('eitaa')) {
    return Uri.parse('https://eitaa.com/$bareId');
  }
  if (p.contains('بله') || p.contains('bale')) {
    return Uri.parse('https://ble.ir/$bareId');
  }
  if (p.contains('تلگرام') || p.contains('telegram')) {
    return Uri.parse(isPhone ? 'https://t.me/+$digits' : 'https://t.me/$bareId');
  }
  if (p.contains('واتس') || p.contains('whatsapp')) {
    return Uri.parse('https://wa.me/$digits');
  }
  return null;
}

/// Opens the chat with the mentor using the ID registered in the database.
Future<void> contactMentor(BuildContext context, UserModel user) async {
  if (_isMentorRole(user)) {
    await SupportMessageDialog.show(context);
    return;
  }

  void showMessage(String text) => AppToast.error(context, text);

  final uri = buildMentorContactUri(user.mentorSocialPlatform, user.mentorSocialHandle);
  if (uri == null) {
    showMessage('اطلاعات راهبر تکمیل نیست.');
    return;
  }

  try {
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched) showMessage('امکان باز کردن لینک راهبر وجود ندارد.');
  } catch (_) {
    showMessage('امکان باز کردن لینک راهبر وجود ندارد.');
  }
}
