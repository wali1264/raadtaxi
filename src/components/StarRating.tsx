
import React, { CSSProperties } from 'react';
import { StarIcon } from './icons';
import { translations, Language } from '../translations';

interface StarRatingProps {
  currentLang: Language;
  count: number;
  rating: number;
  onRatingChange: (rating: number) => void;
  hoverRating: number;
  onHoverRatingChange: (rating: number) => void;
  size?: string;
  color?: string;
  activeColor?: string;
}

export const StarRating: React.FC<StarRatingProps> = ({
  currentLang,
  count,
  rating,
  onRatingChange,
  hoverRating,
  onHoverRatingChange,
  size = '2.2rem',
  color = '#E0E0E0',
  activeColor = '#FFC107',
}) => {
  const t = translations[currentLang];
  const stars = Array.from({ length: count }, (_, i) => i + 1);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0.5rem 0' }}>
      {stars.map((starValue) => {
        const isFilled = (hoverRating || rating) >= starValue;
        const starLabel = t.starAriaLabel.replace('{index}', String(starValue));
        const currentStarColor = (hoverRating >= starValue) ? activeColor : (rating >= starValue ? activeColor : color);

        return (
          <StarIcon
            key={starValue}
            filled={isFilled}
            onClick={() => onRatingChange(starValue)}
            onMouseEnter={() => onHoverRatingChange(starValue)}
            onMouseLeave={() => onHoverRatingChange(0)}
            style={{
                width: size,
                height: size,
                color: currentStarColor,
                margin: '0 0.2rem'
            }}
            ariaLabel={starLabel}
          />
        );
      })}
    </div>
  );
};
