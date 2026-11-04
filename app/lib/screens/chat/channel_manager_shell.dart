import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:nopa_app/core/theme/app_colors.dart';
import 'package:nopa_app/screens/chat/chat_home_screen.dart';
import 'package:nopa_app/services/app_state_repository.dart';
import 'package:nopa_app/widgets/app_top_bar.dart';
import 'package:nopa_app/services/chat_repository.dart';
import 'package:nopa_app/widgets/custom_drawer.dart';

/// The whole app for a channel manager: chat only, without the student or mentor tabs.
class ChannelManagerShell extends StatelessWidget {
  const ChannelManagerShell({super.key});

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<AppRepository>(context).currentUser;
    // the whole screen is the chat (the panel's «آمار» counts it as time in the chat)
    Provider.of<AppRepository>(context, listen: false).chatTabVisible = user.chatEnabled;
    WidgetsBinding.instance.addPostFrameCallback((_) => ChatRepository.instance.setEnabled(user.chatEnabled, user.id));

    return Container(
      decoration: const BoxDecoration(
        gradient: AppColors.screenBackgroundGradient,
        image: DecorationImage(
          image: AssetImage('assets/images/login_bg.png'),
          fit: BoxFit.cover,
        ),
      ),
      child: Scaffold(
        backgroundColor: Colors.transparent,
        drawer: CustomDrawer(role: user.role, currentIndex: -1, onTabSelected: (_) {}),
        body: SafeArea(
          top: !user.chatEnabled,
          child: Column(
            children: [
              // With chat on, the chat screen draws its own header
              if (!user.chatEnabled) const AppTopBar(showBackButton: false, showNotificationIcon: true, showDrawerButton: true),
              Expanded(
                child: user.chatEnabled
                    ? const ChatHomeScreen()
                    : const ChatNotice(
                        title: 'بخش چت غیرفعال است',
                        message: 'پس از فعال شدن چت توسط مدیر، می‌توانید از همین صفحه کار کنید.',
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
