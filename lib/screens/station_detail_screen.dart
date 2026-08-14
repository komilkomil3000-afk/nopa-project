import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/station.dart';
import '../models/models.dart';
import '../services/app_state_repository.dart';
import '../services/api_service.dart';


class StationDetailScreen extends StatefulWidget {
  const StationDetailScreen({super.key});

  @override
  State<StationDetailScreen> createState() => _StationDetailScreenState();
}

class _StationDetailScreenState extends State<StationDetailScreen> {
  bool _isChallengesExpanded = true;
  Map<String, List<Map<String, dynamic>>> _classCategories = {};
  bool _loadingCategories = true;

  @override
  void initState() {
    super.initState();
    _loadClassCategories();
  }

  Future<void> _loadClassCategories() async {
    try {
      final classes = await HttpApiService().getClasses();
      final Map<String, List<Map<String, dynamic>>> map = {};
      for (final c in classes) {
        final t = c['type'] ?? 'other';
        map.putIfAbsent(t, () => []).add(c);
      }
      if (mounted) setState(() { _classCategories = map; _loadingCategories = false; });
    } catch (e) {
      if (mounted) setState(() { _loadingCategories = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final station = ModalRoute.of(context)!.settings.arguments as Station;

    return Scaffold(
      backgroundColor: const Color(0xFF0F081D),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(6),
            decoration: const BoxDecoration(
              color: Colors.white10,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.close, color: Colors.white, size: 20),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          station.title,
          style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        child: Column(
          children: [
            // Circular Progress section
            _buildCircularProgressCard(station),
            const SizedBox(height: 20),
            
            // Statistics Grid (2x2)
            _buildStatsGrid(),
            const SizedBox(height: 20),
            
            // Educational Sections
            _buildExpandableClasses(),
            const SizedBox(height: 16),
            
            // Challenges Section
            _buildChallengesSection(),
            
            const SizedBox(height: 35),
            
            // Main Button
            Container(
              width: double.infinity,
              height: 56,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [
                    Color(0xFF8B5CF6), // Purple
                    Color(0xFFD946EF), // Pink
                  ],
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFD946EF).withValues(alpha: 0.3),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pushNamed(context, '/class_player');
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  shadowColor: Colors.transparent,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'ورود به پنل برگزاری کلاس',
                      style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    SizedBox(width: 8),
                    Text('🚀', style: TextStyle(fontSize: 16)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildCircularProgressCard(Station station) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
      ),
      child: Column(
        children: [
          // Circular Progress Indicator
          Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 130,
                height: 130,
                child: CircularProgressIndicator(
                  value: station.progress,
                  strokeWidth: 10,
                  backgroundColor: Colors.white10,
                  valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFFFFD54F)), // Golden glow progress
                  strokeCap: StrokeCap.round,
                ),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '${(station.progress * 100).toInt()}%',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const Text(
                    'پیشرفت منزلگاه',
                    style: TextStyle(color: Colors.white38, fontSize: 11),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),
          
          // Capsules/Badges Row
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFF2E1E55),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFF8B5CF6).withValues(alpha: 0.3)),
                ),
                child: const Text(
                  'در حال پیشرفت',
                  style: TextStyle(color: Colors.white70, fontSize: 12),
                ),
              ),
              const SizedBox(width: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFF123E33),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
                ),
                child: const Text(
                  '۳ از ۴ کلاس',
                  style: TextStyle(color: Color(0xFF10B981), fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatsGrid() {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      childAspectRatio: 2.8,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      children: [
        _buildStatItem('۱۲ ساعت آموزشی', '۱۲', const Color(0xFFFFD54F)),
        _buildStatItem('۲ اساتید', '۲', const Color(0xFF8B5CF6)),
        _buildStatItem('۴ کلاس‌ها', '۴', const Color(0xFFEC4899)),
        _buildStatItem('۱۹ کاروانیان', '۱۹', const Color(0xFF10B981)),
      ],
    );
  }

  Widget _buildStatItem(String label, String value, Color color) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.03)),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            value,
            style: TextStyle(color: color, fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 2),
          Text(
            label.substring(value.length).trim(),
            style: const TextStyle(color: Colors.white54, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildExpandableClasses() {
    if (_loadingCategories) return const Center(child: CircularProgressIndicator());
    if (_classCategories.isEmpty) {
      return Container(padding: const EdgeInsets.all(12), child: const Text('هیچ کلاسی برای این منزلگاه یافت نشد', style: TextStyle(color: Colors.white54)));
    }

    final entries = _classCategories.entries.toList();
    return Column(
      children: entries.map((e) {
        final title = _mapTypeToTitle(e.key);
        final lessons = e.value.map<Widget>((c) => _buildLessonRow(
          title: c['title'] ?? c['name'] ?? '-',
          status: c['status'] ?? 'در انتظار',
          statusColor: const Color(0xFF8B5CF6),
          participated: false,
          reward: (c['rewardZarik'] as num?)?.toInt() ?? 0,
        )).toList();
        return Column(children: [_buildCustomClassCategory(title: title, count: e.value.length, lessons: lessons), const SizedBox(height: 12)]);
      }).toList(),
    );
  }

  String _mapTypeToTitle(String type) {
    switch (type) {
      case 'skill':
        return 'کلاس‌های مهارتی';
      case 'media':
      case 'video':
        return 'کلاس‌های رسانه‌ای';
      case 'insight':
      case 'بینشی':
        return 'کلاس‌های بینشی';
      default:
        return 'کلاس‌ها';
    }
  }

  Widget _buildCustomClassCategory({
    required String title,
    required int count,
    required List<Widget> lessons,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
      ),
      child: ExpansionTile(
        title: Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFF8B5CF6),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$count',
                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
              ),
            ),
            const SizedBox(width: 8),
            Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14, fontFamily: 'Vazirmatn')),
          ],
        ),
        iconColor: const Color(0xFF8B5CF6),
        collapsedIconColor: Colors.white54,
        childrenPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        shape: const Border(),
        children: lessons,
      ),
    );
  }

  Widget _buildLessonRow({
    required String title,
    required String status,
    required Color statusColor,
    required bool participated,
    required int reward,
  }) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        Navigator.pushNamed(context, '/class_player');
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10.0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Left: status and score
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: participated ? const Color(0xFF10B981).withValues(alpha: 0.12) : Colors.redAccent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: participated ? const Color(0xFF10B981) : Colors.redAccent, width: 1),
                  ),
                  child: Text(
                    participated ? 'شرکت کرده (+$reward زریک) ✅' : 'شرکت نکرده ❌',
                    style: TextStyle(
                      color: participated ? const Color(0xFF10B981) : Colors.redAccent,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'Vazirmatn',
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    status,
                    style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                  ),
                ),
              ],
            ),
            // Right: title
            Row(
              children: [
                Text(
                  title,
                  style: const TextStyle(color: Colors.white70, fontSize: 13, fontFamily: 'Vazirmatn'),
                ),
                const SizedBox(width: 10),
                const Icon(Icons.circle, color: Colors.white24, size: 8),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChallengesSection() {
    final list = Provider.of<AppRepository>(context).challenges;

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
      ),
      child: Column(
        children: [
          ListTile(
            leading: const Text('🏆', style: TextStyle(fontSize: 18)),
            title: const Text(
              'چالش‌ها و تکالیف منزلگاه',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14, fontFamily: 'Vazirmatn'),
            ),
            trailing: Icon(
              _isChallengesExpanded ? Icons.expand_less : Icons.expand_more,
              color: Colors.white54,
            ),
            onTap: () {
              setState(() {
                _isChallengesExpanded = !_isChallengesExpanded;
              });
            },
          ),
          if (_isChallengesExpanded)
            Padding(
              padding: const EdgeInsets.only(left: 16, right: 16, bottom: 16),
              child: Column(
                children: list.map((item) {
                  final submissions = Provider.of<AppRepository>(context, listen: false).submissions;
                  final hasApproved = submissions.any((s) => s.challengeId == item.id && s.status == 'approved');
                  final hasPending = submissions.any((s) => s.challengeId == item.id && s.status == 'pending');

                  final String status = hasApproved
                      ? 'تایید شده ✅'
                      : (hasPending ? 'در انتظار تایید ⏳' : 'انجام نشده ❌');
                  final Color color = hasApproved
                      ? const Color(0xFF10B981)
                      : (hasPending ? const Color(0xFFFFD54F) : Colors.redAccent);

                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: InkWell(
                      onTap: () {
                        if (!hasApproved && !hasPending) {
                          _showChallengeDetailsDialog(
                            context,
                            item.id,
                            item.title,
                            'راهبر',
                            item.rewardZarik,
                            item.type,
                            item.description,
                          );
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('وضعیت چالش: $status', style: const TextStyle(fontFamily: 'Vazirmatn')),
                              backgroundColor: const Color(0xFF8B5CF6),
                            ),
                          );
                        }
                      },
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: color.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              status,
                              style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                            ),
                          ),
                          const Spacer(),
                          Text(
                            'جایزه: ${item.rewardZarik} زریک 🪙',
                            style: const TextStyle(color: Color(0xFFFFD54F), fontSize: 11, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Text(
                              item.title,
                              textAlign: TextAlign.right,
                              style: const TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
        ],
      ),
    );
  }

  void _showChallengeDetailsDialog(
    BuildContext context,
    String challengeId,
    String title,
    String creator,
    int reward,
    String type,
    String desc,
  ) {
    final TextEditingController answerCtrl = TextEditingController();
    String attachedFileName = '';

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return Dialog(
              backgroundColor: const Color(0xFF1E1435),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.close, color: Colors.white70),
                            onPressed: () => Navigator.pop(context),
                          ),
                          Text(
                            title,
                            style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const Divider(color: Colors.white10),
                      const SizedBox(height: 8),
                      
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Text('سازنده چالش: $creator', style: const TextStyle(color: Colors.white30, fontSize: 11)),
                          const SizedBox(width: 14),
                          Text('جایزه: $reward زریک 🪙', style: const TextStyle(color: Color(0xFFFFD54F), fontSize: 11, fontWeight: FontWeight.bold)),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Text(
                        desc,
                        textDirection: TextDirection.rtl,
                        style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.5),
                      ),
                      const SizedBox(height: 20),
                      
                      // Text input for text challenge
                      if (type == 'text') ...[
                        const Text('پاسخ تشریحی شما:', style: TextStyle(color: Colors.white54, fontSize: 12)),
                        const SizedBox(height: 6),
                        TextField(
                          controller: answerCtrl,
                          maxLines: 3,
                          style: const TextStyle(color: Colors.white),
                          textAlign: TextAlign.right,
                          decoration: InputDecoration(
                            hintText: 'پاسخ خود را اینجا بنویسید...',
                            hintStyle: const TextStyle(color: Colors.white24, fontSize: 11),
                            filled: true,
                            fillColor: const Color(0xFF160E2A),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                          ),
                        ),
                      ],
                      
                      const SizedBox(height: 12),
                      
                      // File Upload section
                      const Text('ضمیمه کردن فایل تکلیف:', style: TextStyle(color: Colors.white54, fontSize: 12)),
                      const SizedBox(height: 6),
                      GestureDetector(
                        onTap: () {
                          setDialogState(() {
                            attachedFileName = 'تکلیف_نپا_${title.replaceAll(' ', '_')}.pdf';
                          });
                        },
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF160E2A),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.white12),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Icon(
                                attachedFileName.isEmpty ? Icons.cloud_upload_outlined : Icons.check_circle,
                                color: attachedFileName.isEmpty ? Colors.white30 : const Color(0xFF10B981),
                                size: 20,
                              ),
                              Text(
                                attachedFileName.isEmpty ? 'انتخاب فایل (PDF, MP4, PNG)' : attachedFileName,
                                style: TextStyle(
                                  color: attachedFileName.isEmpty ? Colors.white30 : Colors.white,
                                  fontSize: 11,
                                  fontWeight: attachedFileName.isEmpty ? FontWeight.normal : FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      
                      // Submit Button
                      Container(
                        width: double.infinity,
                        height: 48,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(colors: [Color(0xFF8B5CF6), Color(0xFFD946EF)]),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: ElevatedButton(
                          onPressed: () {
                            if (type == 'text' && answerCtrl.text.isEmpty && attachedFileName.isEmpty) return;
                            if (type == 'file' && attachedFileName.isEmpty) return;

                            Navigator.pop(context);
                            
                            String submissionDetails = 'ارسال شده از صفحه منزلگاه آموزشی.\n';
                            if (answerCtrl.text.isNotEmpty) {
                              submissionDetails += 'پاسخ متنی: ${answerCtrl.text}\n';
                            }
                            if (attachedFileName.isNotEmpty) {
                              submissionDetails += 'فایل ضمیمه: $attachedFileName';
                            }

                            final repository = Provider.of<AppRepository>(context, listen: false);
                            repository.submitAssignment(SubmissionModel(
                              id: 's_${DateTime.now().millisecondsSinceEpoch}',
                              challengeId: challengeId,
                              studentId: repository.currentUser.id,
                              studentName: repository.currentUser.name,
                              answerText: submissionDetails,
                              submittedAt: DateTime.now(),
                              status: 'pending',
                            ));

                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('چالش با موفقیت ارسال شد و در لیست بررسی راهبر قرار گرفت ✅'),
                                backgroundColor: Color(0xFF10B981),
                              ),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.transparent,
                            shadowColor: Colors.transparent,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          child: const Text('ثبت و ارسال به راهبر', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}
