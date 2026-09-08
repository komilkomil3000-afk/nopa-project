import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/app_state_repository.dart';
import 'nopa_notification_dialog.dart';

class NotificationBellButton extends StatelessWidget {
  final double iconSize;
  final EdgeInsetsGeometry padding;

  const NotificationBellButton({
    super.key,
    this.iconSize = 20,
    this.padding = const EdgeInsets.all(8),
  });

  @override
  Widget build(BuildContext context) {
    return Consumer<AppRepository>(
      builder: (context, repository, _) {
        final count = repository.unreadNotificationsCount;
        final bool hasUnread = count > 0;

        return GestureDetector(
          onTap: () => NopaNotificationDialog.show(context),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                padding: padding,
                decoration: BoxDecoration(
                  color: hasUnread
                      ? Colors.redAccent.withValues(alpha: 0.15)
                      : Colors.black38,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: hasUnread
                        ? Colors.redAccent.withValues(alpha: 0.5)
                        : Colors.white10,
                    width: 1,
                  ),
                ),
                child: Icon(
                  hasUnread ? Icons.notifications_active : Icons.notifications_none,
                  color: hasUnread ? const Color(0xFFFF5252) : Colors.white,
                  size: iconSize,
                ),
              ),
              if (hasUnread)
                Positioned(
                  right: -1,
                  top: -1,
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444),
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0xFF1E1435), width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.red.withValues(alpha: 0.5),
                          blurRadius: 4,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                    child: Center(
                      child: Text(
                        count > 9 ? '+9' : '$count',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                          height: 1,
                          fontFamily: 'Vazirmatn',
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
