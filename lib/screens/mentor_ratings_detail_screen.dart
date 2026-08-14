import 'package:flutter/material.dart';
import '../utils/rating_manager.dart';

class MentorRatingsDetailScreen extends StatelessWidget {
  const MentorRatingsDetailScreen({super.key});

  @override
  Widget build(BuildContext context) {
    String ratingText = 'خوب';
    if (RatingManager.averageRating >= 4.7) {
      ratingText = 'عالی';
    } else if (RatingManager.averageRating < 4.0) {
      ratingText = 'نیاز به بهبود';
    }

    return Scaffold(
      backgroundColor: const Color(0xFF0F081D),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('کارنامه ارزیابی راهبری', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        child: Column(
          children: [
            // Rating header card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF1E1435),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
              ),
              child: Column(
                children: [
                  Text(
                    ratingText,
                    style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  
                  // Stars and score row
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.04),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Row(
                          children: List.generate(5, (index) {
                            return Icon(
                              index < RatingManager.averageRating.floor() ? Icons.star : Icons.star_border,
                              color: const Color(0xFFFFD54F),
                              size: 16,
                            );
                          }),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '${RatingManager.averageRating.toStringAsFixed(1)} از ۵',
                          style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'با همین فرمان ادامه بدهید!',
                    style: TextStyle(color: Colors.white54, fontSize: 13),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            
            // Green success banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
              ),
              child: const Text(
                'تبریک! امتیازتان به حد مطلوب رسید. با بالا بردن امتیاز می‌توانید از مزایای راهبران برتر پنج‌ستاره نپا برخوردار شوید.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF10B981), fontSize: 12, height: 1.5, fontWeight: FontWeight.w500),
              ),
            ),
            const SizedBox(height: 24),
            
            // Star Distribution Chart
            _buildStarDistributionSection(),
            const SizedBox(height: 24),
            
            // Most Frequent Choices (پرتکرارترین بازخوردها)
            _buildFeedbackPillsSection(),
            const SizedBox(height: 24),
            
            // Comments Section (نظرات اعضا)
            _buildCommentsSection(),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  Widget _buildStarDistributionSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          const Text(
            'توزیع امتیازات',
            style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          _buildStarRow(5, RatingManager.starDistribution[5]!),
          const SizedBox(height: 8),
          _buildStarRow(4, RatingManager.starDistribution[4]!),
          const SizedBox(height: 8),
          _buildStarRow(3, RatingManager.starDistribution[3]!),
          const SizedBox(height: 8),
          _buildStarRow(2, RatingManager.starDistribution[2]!),
          const SizedBox(height: 8),
          _buildStarRow(1, RatingManager.starDistribution[1]!),
          const SizedBox(height: 14),
          Center(
            child: Text(
              'بر اساس ${RatingManager.totalRatings} ارزیابی اخیر',
              style: const TextStyle(color: Colors.white30, fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStarRow(int stars, int count) {
    double progress = count / RatingManager.totalRatings;
    return Row(
      children: [
        Text('$count نفر', style: const TextStyle(color: Colors.white54, fontSize: 11)),
        const SizedBox(width: 10),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              backgroundColor: const Color(0xFF160E2A),
              valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFFFFD54F)),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Row(
          children: [
            const Icon(Icons.star, color: Color(0xFFFFD54F), size: 12),
            const SizedBox(width: 4),
            Text('$stars', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
          ],
        ),
      ],
    );
  }

  Widget _buildFeedbackPillsSection() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          const Text(
            'پرتکرارترین گزینه‌های انتخابی مسافران:',
            style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.end,
            children: [
              ...RatingManager.topStrengths.map((str) => Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.4)),
                    ),
                    child: Text(str, style: const TextStyle(color: Color(0xFF10B981), fontSize: 12, fontWeight: FontWeight.bold)),
                  )),
              ...RatingManager.topWeaknesses.map((str) => Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.redAccent.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.redAccent.withValues(alpha: 0.4)),
                    ),
                    child: Text(str, style: const TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.bold)),
                  )),
            ],
          )
        ],
      ),
    );
  }

  Widget _buildCommentsSection() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1435),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          const Text(
            'اعضای کاروان درباره شما گفته‌اند:',
            style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: RatingManager.comments.length,
            itemBuilder: (context, index) {
              final comment = RatingManager.comments[index];
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF160E2A),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: List.generate(5, (idx) {
                            return Icon(
                              idx < comment['stars'] ? Icons.star : Icons.star_border,
                              color: const Color(0xFFFFD54F),
                              size: 12,
                            );
                          }),
                        ),
                        const Icon(Icons.account_circle_outlined, color: Colors.white24, size: 20),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      comment['comment'],
                      textAlign: TextAlign.right,
                      style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.4),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}
