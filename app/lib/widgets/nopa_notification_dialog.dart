import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/app_state_repository.dart';
import '../services/api_service.dart';
import '../models/user_model.dart';
import '../main.dart';
import 'complete_profile_dialog.dart';
import 'jarchi_item.dart';

class NopaNotificationDialog {
  static Future<void> handleNotificationTap(
    BuildContext context,
    AppRepository repository,
    Map<String, dynamic> notify,
  ) async {
    final String notifId = notify['id']?.toString() ?? '';
    if (notifId.isNotEmpty) {
      await repository.markNotificationAsRead(notifId);
    }

    final String title = notify['title'] ?? '';
    final String body = notify['body'] ?? '';
    final String type = notify['type'] ?? '';
    final bool isMentor = repository.currentUser.role == UserRole.mentor ||
        repository.currentUser.role == UserRole.superMentor;

    // 1. News / جارچی اطلاعیه‌ها
    if (type == 'news' ||
        title.contains('📢') ||
        title.contains('خبر') ||
        body.contains('خبر') ||
        title.contains('جارچی')) {
      if (!isMentor) {
        navigateToMainTab(0);
      }
      try {
        final newsList = await HttpApiService().getNews();
        Map<String, dynamic>? matched;
        for (final n in newsList) {
          final nTitle = n['title']?.toString() ?? '';
          if (nTitle.isNotEmpty &&
              (title.contains(nTitle) ||
                  nTitle.contains(title.replaceAll('📢', '').trim()))) {
            matched = n;
            break;
          }
        }

        final String itemTitle = matched?['title'] ?? title;
        final String itemContent = matched?['body'] ?? body;
        final String? link = matched?['reporter'];
        String imageUrl =
            'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400';
        if (matched?['imageUrl'] != null) {
          imageUrl =
              '${HttpApiService().baseUrl.replaceAll('/api/v1', '')}${matched!['imageUrl']}';
        }
        final date = DateTime.tryParse(matched?['createdAt'] ?? '');
        final dateStr = date != null
            ? '${date.year}/${date.month}/${date.day}'
            : (notify['time'] ?? 'الان');

        if (context.mounted) {
          JarchiItem.showNewsDialog(
            context,
            title: itemTitle,
            date: dateStr,
            imageUrl: imageUrl,
            content: itemContent,
            link: link,
          );
        }
      } catch (_) {
        if (context.mounted) {
          JarchiItem.showNewsDialog(
            context,
            title: title,
            date: notify['time'] ?? 'الان',
            imageUrl:
                'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=400',
            content: body,
          );
        }
      }
      return;
    }

    // 2. Complete Profile / تکمیل پروفایل
    if (title.contains('تکمیل پروفایل') ||
        body.contains('تکمیل پروفایل') ||
        title.contains('پروفایل')) {
      if (context.mounted) {
        CompleteProfileDialog.show(context, repository.currentUser);
      }
      return;
    }

    // 3. Challenge / چالش و پاسخ‌ها
    if (type == 'challenge' ||
        title.contains('چالش') ||
        body.contains('چالش') ||
        title.contains('پاسخ') ||
        body.contains('پاسخ') ||
        title.contains('تایید شد') ||
        title.contains('رد شد')) {
      if (isMentor) {
        navigateToMainTab(2); // Mentor Tasks tab
      } else {
        navigateToMainTab(2); // Student Challenges tab
      }
      return;
    }

    // 4. Tickets / تیکت‌ها و پشتیبانی
    if (title.contains('تیکت') ||
        body.contains('تیکت') ||
        title.contains('پشتیبانی')) {
      if (context.mounted) {
        Navigator.pushNamed(context, '/tickets');
      }
      return;
    }

    // 5. Market / فروشگاه / زریک / سکه
    if (title.contains('فروشگاه') ||
        body.contains('فروشگاه') ||
        title.contains('سکه') ||
        body.contains('زریک')) {
      if (!isMentor) {
        navigateToMainTab(3); // Student Market tab
      }
      return;
    }

    // 6. Map / Stations / نقشه و ایستگاه‌ها
    if (title.contains('ایستگاه') ||
        body.contains('ایستگاه') ||
        title.contains('نقشه')) {
      if (!isMentor) {
        navigateToMainTab(1); // Student Map tab
      }
      return;
    }

    // 7. Ratings / League / کارنامه ارزیابی
    if (title.contains('ارزیابی') ||
        title.contains('کارنامه') ||
        title.contains('لیگ')) {
      if (isMentor) {
        if (context.mounted) {
          Navigator.pushNamed(context, '/mentor_ratings');
        }
      }
      return;
    }

    // Fallback: Show detail popup
    if (context.mounted) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: const Color(0xFF1E1435),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Text(
            title,
            textAlign: TextAlign.right,
            style: const TextStyle(
              color: Colors.white,
              fontFamily: 'Vazirmatn',
              fontSize: 14,
              fontWeight: FontWeight.bold,
            ),
          ),
          content: Text(
            body,
            textAlign: TextAlign.right,
            style: const TextStyle(
              color: Colors.white70,
              fontFamily: 'Vazirmatn',
              fontSize: 12,
              height: 1.6,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text(
                'بستن',
                style: TextStyle(
                  color: Color(0xFF8B5CF6),
                  fontFamily: 'Vazirmatn',
                ),
              ),
            ),
          ],
        ),
      );
    }
  }

  static void show(BuildContext context) {
    final repository = Provider.of<AppRepository>(context, listen: false);
    // Fetch fresh notifications from server immediately (without marking all as read!)
    repository.fetchNotifications();

    showDialog(
      context: context,
      builder: (BuildContext dialogContext) {
        return ListenableBuilder(
          listenable: repository,
          builder: (context, _) {
            final userRole = repository.currentUser.role;
            final isMentor = userRole == UserRole.mentor ||
                userRole == UserRole.superMentor;
            // Only unread notifications are displayed in active notifications dialog
            final list = repository.notifications
                .where((n) => n['isRead'] != true && n['isForMentor'] == isMentor)
                .toList();

            return Dialog(
              backgroundColor: const Color(0xFF1E1435),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(24)),
              child: Container(
                padding: const EdgeInsets.all(20),
                width: double.infinity,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.close,
                                  color: Colors.white70),
                              onPressed: () => Navigator.pop(dialogContext),
                            ),
                            IconButton(
                              icon: const Icon(Icons.refresh,
                                  color: Colors.white70, size: 20),
                              tooltip: 'به‌روزرسانی',
                              onPressed: () => repository.fetchNotifications(),
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            if (list.isNotEmpty)
                              TextButton.icon(
                                onPressed: () {
                                  repository.markAllNotificationsAsRead();
                                },
                                icon: const Icon(Icons.done_all_rounded,
                                    size: 15, color: Color(0xFF8B5CF6)),
                                label: const Text(
                                  'خواندن همه',
                                  style: TextStyle(
                                    color: Color(0xFF8B5CF6),
                                    fontSize: 11,
                                    fontFamily: 'Vazirmatn',
                                  ),
                                ),
                              ),
                            const SizedBox(width: 4),
                            const Text(
                              'اعلان‌ها و پیام‌های نپا 🚩',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'Vazirmatn',
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const Divider(color: Colors.white10),
                    const SizedBox(height: 10),
                    if (list.isEmpty)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.symmetric(vertical: 30.0),
                          child: Column(
                            children: [
                              Icon(Icons.notifications_off_outlined,
                                  color: Colors.white24, size: 40),
                              SizedBox(height: 10),
                              Text(
                                'پیام یا اعلان جدیدی وجود ندارد 🔔',
                                style: TextStyle(
                                  color: Colors.white38,
                                  fontSize: 12,
                                  fontFamily: 'Vazirmatn',
                                ),
                              ),
                              SizedBox(height: 4),
                              Text(
                                'اعلان‌های قبلی در آرشیو پروفایل در دسترس هستند',
                                style: TextStyle(
                                  color: Colors.white24,
                                  fontSize: 10.5,
                                  fontFamily: 'Vazirmatn',
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      Flexible(
                        child: ListView.builder(
                          shrinkWrap: true,
                          itemCount: list.length,
                          itemBuilder: (context, index) {
                            final notify = list[index];
                            final String title = notify['title'] ?? 'اعلان جدید';
                            final bool isReject =
                                title.contains('رد شد') || title.contains('❌');
                            final bool isApprove =
                                title.contains('تایید شد') || title.contains('✅');
                            final bool isNews = notify['type'] == 'news' ||
                                title.contains('📢') ||
                                title.contains('خبر');
                            final bool isProfile =
                                title.contains('تکمیل پروفایل') ||
                                    (notify['body'] ?? '')
                                        .toString()
                                        .contains('تکمیل');

                            Color bgColor = const Color(0xFF160E2A);
                            Color borderColor =
                                Colors.white.withValues(alpha: 0.05);
                            Color titleColor = Colors.white;
                            IconData iconData = Icons.notifications_rounded;
                            Color iconColor = const Color(0xFFD946EF);
                            String actionHint = 'لمس برای مشاهده 👈';

                            if (isReject) {
                              bgColor = const Color(0xFFEF4444)
                                  .withValues(alpha: 0.1);
                              borderColor = const Color(0xFFEF4444)
                                  .withValues(alpha: 0.3);
                              titleColor = const Color(0xFFF87171);
                              iconData = Icons.cancel_rounded;
                              iconColor = const Color(0xFFF87171);
                              actionHint = 'مشاهده چالش 🏆';
                            } else if (isApprove) {
                              bgColor = const Color(0xFF10B981)
                                  .withValues(alpha: 0.1);
                              borderColor = const Color(0xFF10B981)
                                  .withValues(alpha: 0.3);
                              titleColor = const Color(0xFF34D399);
                              iconData = Icons.check_circle_rounded;
                              iconColor = const Color(0xFF34D399);
                              actionHint = 'مشاهده چالش 🏆';
                            } else if (isNews) {
                              bgColor = const Color(0xFF0284C7)
                                  .withValues(alpha: 0.14);
                              borderColor = const Color(0xFF38BDF8)
                                  .withValues(alpha: 0.35);
                              titleColor = const Color(0xFF38BDF8);
                              iconData = Icons.campaign_rounded;
                              iconColor = const Color(0xFF38BDF8);
                              actionHint = 'مشاهده خبر 📰';
                            } else if (isProfile) {
                              actionHint = 'تکمیل پروفایل ⭐';
                            }

                            return Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              decoration: BoxDecoration(
                                color: bgColor,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: borderColor),
                              ),
                              child: Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(16),
                                  onTap: () async {
                                    Navigator.pop(dialogContext);
                                    await handleNotificationTap(
                                        context, repository, notify);
                                  },
                                  child: Padding(
                                    padding: const EdgeInsets.all(14),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceBetween,
                                          children: [
                                            Row(
                                              children: [
                                                if (isNews)
                                                  Container(
                                                    padding: const EdgeInsets
                                                        .symmetric(
                                                        horizontal: 6,
                                                        vertical: 2),
                                                    margin: const EdgeInsets
                                                        .only(left: 6),
                                                    decoration: BoxDecoration(
                                                      color: const Color(
                                                              0xFF0284C7)
                                                          .withValues(
                                                              alpha: 0.25),
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                              6),
                                                      border: Border.all(
                                                          color: const Color(
                                                                  0xFF38BDF8)
                                                              .withValues(
                                                                  alpha: 0.4)),
                                                    ),
                                                    child: const Text(
                                                      'خبر جارچی',
                                                      style: TextStyle(
                                                        color:
                                                            Color(0xFF38BDF8),
                                                        fontSize: 8.5,
                                                        fontWeight:
                                                            FontWeight.bold,
                                                        fontFamily: 'Vazirmatn',
                                                      ),
                                                    ),
                                                  ),
                                                Text(
                                                  notify['time'] ?? 'الان',
                                                  style: const TextStyle(
                                                    color: Colors.white38,
                                                    fontSize: 9,
                                                    fontFamily: 'Vazirmatn',
                                                  ),
                                                ),
                                              ],
                                            ),
                                            Expanded(
                                              child: Row(
                                                mainAxisAlignment:
                                                    MainAxisAlignment.end,
                                                children: [
                                                  Flexible(
                                                    child: Text(
                                                      title,
                                                      textAlign:
                                                          TextAlign.right,
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                      style: TextStyle(
                                                        color: titleColor,
                                                        fontSize: 12,
                                                        fontWeight:
                                                            FontWeight.bold,
                                                        fontFamily: 'Vazirmatn',
                                                      ),
                                                    ),
                                                  ),
                                                  const SizedBox(width: 6),
                                                  Icon(
                                                    iconData,
                                                    size: 16,
                                                    color: iconColor,
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          notify['body'] ?? '',
                                          textAlign: TextAlign.right,
                                          style: TextStyle(
                                            color: isReject
                                                ? const Color(0xFFFCA5A5)
                                                : Colors.white70,
                                            fontSize: 11,
                                            height: 1.5,
                                            fontFamily: 'Vazirmatn',
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                        Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceBetween,
                                          children: [
                                            Row(
                                              children: [
                                                Icon(
                                                  Icons.arrow_back_ios_new_rounded,
                                                  size: 11,
                                                  color: iconColor
                                                      .withValues(alpha: 0.8),
                                                ),
                                                const SizedBox(width: 4),
                                                Text(
                                                  actionHint,
                                                  style: TextStyle(
                                                    color: iconColor,
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.bold,
                                                    fontFamily: 'Vazirmatn',
                                                  ),
                                                ),
                                              ],
                                            ),
                                            Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: Colors.white
                                                    .withValues(alpha: 0.05),
                                                borderRadius:
                                                    BorderRadius.circular(6),
                                              ),
                                              child: const Text(
                                                'جدید',
                                                style: TextStyle(
                                                  color: Color(0xFFD946EF),
                                                  fontSize: 9,
                                                  fontWeight: FontWeight.bold,
                                                  fontFamily: 'Vazirmatn',
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                        if (isProfile) ...[
                                          const SizedBox(height: 8),
                                          SizedBox(
                                            width: double.infinity,
                                            child: ElevatedButton(
                                              onPressed: () async {
                                                Navigator.pop(dialogContext);
                                                await handleNotificationTap(
                                                    context,
                                                    repository,
                                                    notify);
                                              },
                                              style: ElevatedButton.styleFrom(
                                                backgroundColor:
                                                    const Color(0xFF8B5CF6),
                                                foregroundColor: Colors.white,
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                        vertical: 8),
                                                shape: RoundedRectangleBorder(
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                            10)),
                                                elevation: 2,
                                              ),
                                              child: const Row(
                                                mainAxisAlignment:
                                                    MainAxisAlignment.center,
                                                children: [
                                                  Icon(Icons.stars_rounded,
                                                      color: Color(0xFFFFD54F),
                                                      size: 16),
                                                  SizedBox(width: 6),
                                                  Text(
                                                    'تکمیل پروفایل (دریافت ۱۰۰ سکه)',
                                                    style: TextStyle(
                                                      fontFamily: 'Vazirmatn',
                                                      fontWeight:
                                                          FontWeight.bold,
                                                      fontSize: 11.5,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
