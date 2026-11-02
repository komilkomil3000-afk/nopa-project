import 'package:nopa_app/screens/chat/chat_widgets.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:provider/provider.dart';
import 'package:nopa_app/screens/chat/chat_theme.dart';
import 'package:nopa_app/screens/chat/chat_topic_info_screen.dart';
import 'package:nopa_app/services/api_service.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/widgets/app_toast.dart';
import 'package:nopa_app/widgets/fa_text.dart';
import 'package:nopa_app/widgets/safe_avatar.dart';

/// A channel manager's own account: who they are, and their password.
class ChannelManagerProfileScreen extends StatefulWidget {
  const ChannelManagerProfileScreen({super.key});

  @override
  State<ChannelManagerProfileScreen> createState() => _ChannelManagerProfileScreenState();
}

class _ChannelManagerProfileScreenState extends State<ChannelManagerProfileScreen> {
  final TextEditingController _current = TextEditingController();
  final TextEditingController _next = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_current.text.isEmpty || _next.text.length < 6) {
      AppToast.error(context, 'رمز فعلی و رمز جدید (حداقل ۶ نویسه) را وارد کنید.');
      return;
    }
    setState(() => _busy = true);
    final ok = await HttpApiService().changePassword(_current.text, _next.text);
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      _current.clear();
      _next.clear();
      AppToast.success(context, 'رمز عبور تغییر کرد.');
    } else {
      AppToast.error(context, 'تغییر رمز انجام نشد. رمز فعلی را بررسی کنید.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<AppRepository>(context, listen: false).currentUser;
    return ChatPageScaffold(
      title: 'حساب کاربری',
      body: Directionality(
        textDirection: TextDirection.rtl,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Center(child: SafeAvatar(imageUrl: user.avatarUrl, name: user.name, radius: 38, gender: user.gender)),
            const SizedBox(height: 10),
            Text(user.name, style: ChatTheme.title.copyWith(fontSize: 16), textAlign: TextAlign.center),
            Text('مسئول کانال و گروه‌ها · ${user.phoneNumber}', style: ChatTheme.caption, textAlign: TextAlign.center),
            const SizedBox(height: 20),
            Text('تغییر رمز عبور', style: ChatTheme.title),
            const SizedBox(height: 8),
            TextField(controller: _current, obscureText: true, style: ChatTheme.body, decoration: chatField('رمز فعلی')),
            const SizedBox(height: 8),
            TextField(controller: _next, obscureText: true, style: ChatTheme.body, decoration: chatField('رمز جدید')),
            const SizedBox(height: 10),
            ChatButton(label: 'ذخیره', onPressed: _busy ? null : _save),
          ],
        ),
      ),
    );
  }
}
