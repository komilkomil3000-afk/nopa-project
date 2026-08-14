import 'package:flutter/material.dart';
import '../utils/constants.dart';

import '../utils/global_state.dart';

class FloatingAssetsCard extends StatelessWidget {
  const FloatingAssetsCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardBackground.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.purple.withValues(alpha: 0.3)),
        boxShadow: [
          BoxShadow(
            color: AppColors.purple.withValues(alpha: 0.2),
            blurRadius: 20,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildAssetItem(AppStrings.zarik, '${GlobalState.zarik}', AppColors.gold, Icons.monetization_on),
          _buildAssetItem(AppStrings.nakh, '${GlobalState.nakh}', AppColors.purple, Icons.grain),
          _buildAssetItem(AppStrings.beyragh, '${GlobalState.beyragh}', AppColors.pink, Icons.flag),
          _buildAssetItem(AppStrings.farsh, '${GlobalState.farsh}', AppColors.purple, Icons.grid_view),
        ],
      ),
    );
  }

  Widget _buildAssetItem(String label, String value, Color color, IconData icon) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: color, size: 24),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.bold,
            fontSize: 16,
            shadows: [
              Shadow(color: color.withValues(alpha: 0.5), blurRadius: 10),
            ],
          ),
        ),
        Text(
          label,
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
        ),
      ],
    );
  }
}
