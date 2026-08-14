import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/app_state_repository.dart';
import '../models/models.dart';


class CreateChallengeDialog extends StatefulWidget {
  final VoidCallback onSuccess;

  const CreateChallengeDialog({
    super.key,
    required this.onSuccess,
  });

  static void show(BuildContext context, {required VoidCallback onSuccess}) {
    showDialog(
      context: context,
      builder: (context) => CreateChallengeDialog(onSuccess: onSuccess),
    );
  }

  @override
  State<CreateChallengeDialog> createState() => _CreateChallengeDialogState();
}

class _CreateChallengeDialogState extends State<CreateChallengeDialog> {
  int _step = 1; // 1: Choose Type, 2: Design Details
  String _selectedType = 'text'; // text, multiple_choice, file

  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _scoreCtrl = TextEditingController(text: '200');

  // Multi-Question builder for MCQ type
  final List<Map<String, dynamic>> _mcqQuestions = [
    {
      'question': '',
      'options': ['گزینه ۱', 'گزینه ۲'],
      'correctIndex': 0,
    }
  ];

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _scoreCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFF1E1435),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Container(
        padding: const EdgeInsets.all(22),
        width: 400,
        constraints: const BoxConstraints(maxHeight: 650),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Dialog Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white70),
                  onPressed: () => Navigator.pop(context),
                ),
                Text(
                  _step == 1 ? 'گام ۱: انتخاب نوع چالش' : 'گام ۲: طراحی جزئیات چالش',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'Vazirmatn',
                  ),
                ),
                if (_step == 2)
                  IconButton(
                    icon: const Icon(Icons.arrow_forward, color: Colors.white70),
                    onPressed: () {
                      setState(() {
                        _step = 1;
                      });
                    },
                  )
                else
                  const SizedBox(width: 40),
              ],
            ),
            const Divider(color: Colors.white12),
            const SizedBox(height: 12),

            Expanded(
              child: SingleChildScrollView(
                child: _step == 1 ? _buildStep1() : _buildStep2(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --- STEP 1: CHOOSE TYPE ---
  Widget _buildStep1() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        const Text(
          'نوع چالشی که می‌خواهید طراحی کنید را انتخاب کنید:',
          textAlign: TextAlign.right,
          style: TextStyle(color: Colors.white70, fontSize: 13, fontFamily: 'Vazirmatn'),
        ),
        const SizedBox(height: 16),
        _buildTypeCard(
          type: 'text',
          title: 'پاسخ تشریحی / متنی ✍️',
          desc: 'اعضا باید پاسخ‌های تحلیلی و گزارش کار خود را بنویسند.',
        ),
        const SizedBox(height: 12),
        _buildTypeCard(
          type: 'multiple_choice',
          title: 'آزمون چند گزینه‌ای (تستی) 📊',
          desc: 'طراحی آزمون و سوالات تستی با امکان تعیین جواب صحیح.',
        ),
        const SizedBox(height: 12),
        _buildTypeCard(
          type: 'file',
          title: 'ارسال مدرک و فایل تکلیف 📥',
          desc: 'اعضا باید عکس، ویدیو یا فایل PDF به عنوان مدرک کار بفرستند.',
        ),
      ],
    );
  }

  Widget _buildTypeCard({required String type, required String title, required String desc}) {
    final isSelected = _selectedType == type;

    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedType = type;
          _step = 2;
        });
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF160E2A),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? const Color(0xFF8B5CF6) : Colors.white.withValues(alpha: 0.05),
            width: 1.5,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              title,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14, fontFamily: 'Vazirmatn'),
            ),
            const SizedBox(height: 4),
            Text(
              desc,
              textAlign: TextAlign.right,
              style: const TextStyle(color: Colors.white54, fontSize: 11, fontFamily: 'Vazirmatn'),
            ),
          ],
        ),
      ),
    );
  }

  // --- STEP 2: DESIGN DETAILS ---
  Widget _buildStep2() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        // Title
        const Text('عنوان چالش یا تکلیف:', style: TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn')),
        const SizedBox(height: 6),
        TextField(
          controller: _titleCtrl,
          style: const TextStyle(color: Colors.white, fontSize: 13),
          textAlign: TextAlign.right,
          decoration: InputDecoration(
            hintText: 'مثلاً: مسابقه روزنامه‌نگاری کاروان',
            hintStyle: const TextStyle(color: Colors.white24, fontSize: 11),
            filled: true,
            fillColor: const Color(0xFF160E2A),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          ),
        ),
        const SizedBox(height: 12),

        // Description
        const Text('شرح و سناریوی چالش:', style: TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn')),
        const SizedBox(height: 6),
        TextField(
          controller: _descCtrl,
          maxLines: 2,
          style: const TextStyle(color: Colors.white, fontSize: 13),
          textAlign: TextAlign.right,
          decoration: InputDecoration(
            hintText: 'دستورالعمل و اهداف چالش را بنویسید...',
            hintStyle: const TextStyle(color: Colors.white24, fontSize: 11),
            filled: true,
            fillColor: const Color(0xFF160E2A),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          ),
        ),
        const SizedBox(height: 12),

        // MCQ Questions Builder
        if (_selectedType == 'multiple_choice') ...[
          const Text('طراحی سوالات آزمون:', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14, fontFamily: 'Vazirmatn')),
          const Divider(color: Colors.white10),
          ...List.generate(_mcqQuestions.length, (qIdx) {
            final q = _mcqQuestions[qIdx];
            final List<String> options = q['options'];

            return Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF160E2A),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      if (_mcqQuestions.length > 1)
                        IconButton(
                          icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
                          onPressed: () {
                            setState(() {
                              _mcqQuestions.removeAt(qIdx);
                            });
                          },
                        )
                      else
                        const SizedBox(),
                      Text('سوال شماره ${qIdx + 1}', style: const TextStyle(color: Color(0xFFEC4899), fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn')),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text('متن سوال:', style: TextStyle(color: Colors.white70, fontSize: 11, fontFamily: 'Vazirmatn')),
                  const SizedBox(height: 4),
                  TextFormField(
                    initialValue: q['question'],
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                    textAlign: TextAlign.right,
                    onChanged: (val) => q['question'] = val,
                    decoration: InputDecoration(
                      hintText: 'سوال را اینجا تایپ کنید...',
                      hintStyle: const TextStyle(color: Colors.white24, fontSize: 10),
                      filled: true,
                      fillColor: const Color(0xFF1E1435),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                  ),
                  const SizedBox(height: 12),
                  
                  // Options List
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      TextButton.icon(
                        onPressed: () {
                          setState(() {
                            options.add('گزینه جدید');
                          });
                        },
                        icon: const Icon(Icons.add, size: 14, color: Color(0xFF10B981)),
                        label: const Text('افزودن گزینه', style: TextStyle(color: Color(0xFF10B981), fontSize: 10, fontFamily: 'Vazirmatn')),
                      ),
                      const Text('گزینه‌ها و تعیین پاسخ صحیح:', style: TextStyle(color: Colors.white70, fontSize: 11, fontFamily: 'Vazirmatn')),
                    ],
                  ),
                  ...List.generate(options.length, (oIdx) {
                    final isCorrect = q['correctIndex'] == oIdx;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 6.0),
                      child: Row(
                        children: [
                          if (options.length > 2)
                            IconButton(
                              icon: const Icon(Icons.remove_circle_outline, color: Colors.redAccent, size: 18),
                              onPressed: () {
                                setState(() {
                                  options.removeAt(oIdx);
                                  if (q['correctIndex'] >= options.length) {
                                    q['correctIndex'] = 0;
                                  }
                                });
                              },
                            ),
                          GestureDetector(
                            onTap: () {
                              setState(() {
                                q['correctIndex'] = oIdx;
                              });
                            },
                            child: Icon(
                              isCorrect ? Icons.radio_button_checked : Icons.radio_button_off,
                              color: isCorrect ? const Color(0xFF10B981) : Colors.white30,
                              size: 18,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: TextFormField(
                              initialValue: options[oIdx],
                              style: const TextStyle(color: Colors.white, fontSize: 11),
                              textAlign: TextAlign.right,
                              onChanged: (val) => options[oIdx] = val,
                              decoration: InputDecoration(
                                filled: true,
                                fillColor: const Color(0xFF1E1435),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                ],
              ),
            );
          }),
          // Add Question Button
          Center(
            child: TextButton.icon(
              onPressed: () {
                setState(() {
                  _mcqQuestions.add({
                    'question': '',
                    'options': ['گزینه ۱', 'گزینه ۲'],
                    'correctIndex': 0,
                  });
                });
              },
              icon: const Icon(Icons.add_circle_outline, color: Color(0xFF8B5CF6)),
              label: const Text('➕ افزودن سوال جدید به چالش', style: TextStyle(color: Color(0xFF8B5CF6), fontWeight: FontWeight.bold, fontSize: 12, fontFamily: 'Vazirmatn')),
            ),
          ),
          const SizedBox(height: 12),
        ],

        // Reward Score
        const Text('پاداش چالش (زریک):', style: TextStyle(color: Colors.white70, fontSize: 12, fontFamily: 'Vazirmatn')),
        const SizedBox(height: 6),
        TextField(
          controller: _scoreCtrl,
          keyboardType: TextInputType.number,
          style: const TextStyle(color: Color(0xFFFFD54F), fontWeight: FontWeight.bold, fontSize: 14),
          textAlign: TextAlign.center,
          decoration: InputDecoration(
            filled: true,
            fillColor: const Color(0xFF160E2A),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          ),
        ),
        const SizedBox(height: 24),

        // Submit Button
        Container(
          width: double.infinity,
          height: 48,
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [Color(0xFF10B981), Color(0xFF059669)]),
            borderRadius: BorderRadius.circular(14),
          ),
          child: ElevatedButton(
            onPressed: () {
              if (_titleCtrl.text.isEmpty) return;

              final repository = Provider.of<AppRepository>(context, listen: false);

              final newChallenge = ChallengeModel(
                id: 'c_${DateTime.now().millisecondsSinceEpoch}',
                title: _titleCtrl.text,
                description: _descCtrl.text,
                rewardZarik: int.tryParse(_scoreCtrl.text) ?? 200,
                type: _selectedType,
                questions: _selectedType == 'multiple_choice'
                    ? _mcqQuestions.map((q) => {
                        'q': q['question'] ?? '',
                        'options': List<String>.from(q['options'] ?? []),
                        'correct': q['correctIndex'] ?? 0,
                      }).toList()
                    : null,
                createdByMentorId: repository.currentUser.id,
              );

              repository.createChallenge(newChallenge);

              Navigator.pop(context);
              widget.onSuccess();
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.transparent,
              shadowColor: Colors.transparent,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
            child: const Text(
              'ثبت و ابلاغ عمومی چالش 🚀',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontFamily: 'Vazirmatn'),
            ),
          ),
        ),
      ],
    );
  }
}
