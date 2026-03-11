// src/components/marketplace/ReviewSection.jsx
import React, { useState, useEffect } from "react";
import { MessageSquare, ThumbsUp } from "lucide-react";
import StarRating from "./StarRating";
import { useMarketplaceStore } from "../../store/MarketplaceStore";
import { useAuth } from "../../contexts/AuthContext";

export default function ReviewSection({ productId }) {
  const { user } = useAuth();
  const {
    reviews,
    reviewsDistribution,
    reviewsLoading,
    fetchReviews,
    submitReview,
  } = useMarketplaceStore();

  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (productId) fetchReviews(productId);
  }, [productId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) {
      setError("Please select a rating");
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await submitReview({ productId, rating, title, body });
    setSubmitting(false);
    if (res.ok) {
      setShowForm(false);
      setRating(0);
      setTitle("");
      setBody("");
    } else {
      setError(res.error || "Failed to submit review");
    }
  };

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : "0.0";

  return (
    <section className="mp-review-section" aria-label="Reviews">
      <div className="mp-review-header">
        <h3>
          <MessageSquare size={20} /> Customer Reviews
        </h3>
        {user && (
          <button className="mp-btn mp-btn-ghost" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "Write a Review"}
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="mp-review-summary">
        <div className="mp-review-avg">
          <span className="mp-review-avg-number">{avgRating}</span>
          <StarRating rating={Number(avgRating)} size={20} />
          <span className="mp-review-count">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Distribution bars */}
        <div className="mp-review-distribution">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = reviewsDistribution.find((d) => d.rating === star)?.count || 0;
            const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
            return (
              <div key={star} className="mp-review-bar-row">
                <span className="mp-bar-label">{star}★</span>
                <div className="mp-bar-track">
                  <div className="mp-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="mp-bar-count">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review Form */}
      {showForm && (
        <form className="mp-review-form" onSubmit={handleSubmit}>
          <div className="mp-review-form-rating">
            <label>Your Rating</label>
            <StarRating rating={rating} interactive onChange={setRating} size={24} />
          </div>
          <input
            type="text"
            className="mp-review-input"
            placeholder="Review title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
          <textarea
            className="mp-review-textarea"
            placeholder="Share your experience with this model..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={2000}
          />
          {error && <p className="mp-review-error">{error}</p>}
          <button className="mp-btn mp-btn-primary" type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
        </form>
      )}

      {/* Reviews List */}
      {reviewsLoading ? (
        <div className="mp-reviews-loading">Loading reviews...</div>
      ) : reviews.length === 0 ? (
        <p className="mp-reviews-empty">No reviews yet. Be the first to review!</p>
      ) : (
        <div className="mp-reviews-list">
          {reviews.map((r) => (
            <article key={r._id} className="mp-review-card">
              <div className="mp-review-card-header">
                <div className="mp-review-user">
                  {r.user?.avatar ? (
                    <img src={r.user.avatar} alt="" className="mp-review-avatar" />
                  ) : (
                    <div className="mp-review-avatar-placeholder">
                      {(r.user?.name || "U")[0].toUpperCase()}
                    </div>
                  )}
                  <span className="mp-review-username">{r.user?.name || "Anonymous"}</span>
                  {r.verified && <span className="mp-badge mp-badge-verified">Verified Purchase</span>}
                </div>
                <StarRating rating={r.rating} size={14} />
              </div>
              {r.title && <h4 className="mp-review-card-title">{r.title}</h4>}
              {r.body && <p className="mp-review-card-body">{r.body}</p>}
              <time className="mp-review-date">
                {new Date(r.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
