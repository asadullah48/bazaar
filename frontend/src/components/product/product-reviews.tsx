"use client";
import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { reviewsApi, PaginatedReviews, ReviewResponse } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { Rating } from "./rating";

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5"
        >
          <Star
            size={24}
            className={
              i <= (hover || value)
                ? "fill-amber-400 text-amber-400"
                : "fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700"
            }
          />
        </button>
      ))}
    </div>
  );
}

interface Props {
  productId: string;
}

export function ProductReviews({ productId }: Props) {
  const { accessToken, isAuthenticated } = useAuthStore();
  const [data, setData] = useState<PaginatedReviews | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // form state
  const [orderId, setOrderId] = useState("");
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setLoading(true);
    reviewsApi
      .list(productId, page)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productId, page]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (rating === 0) {
      setFormError("Please select a star rating.");
      return;
    }
    if (body.length < 20) {
      setFormError("Review must be at least 20 characters.");
      return;
    }
    if (!orderId.trim()) {
      setFormError("Please enter your Order ID.");
      return;
    }
    setSubmitting(true);
    try {
      const review = await reviewsApi.create(accessToken!, {
        order_id: orderId.trim(),
        product_id: productId,
        rating,
        body,
        title: title || undefined,
      });
      setData((prev) =>
        prev
          ? { ...prev, items: [review, ...prev.items], total: prev.total + 1 }
          : null
      );
      setSubmitted(true);
      setOrderId("");
      setRating(0);
      setTitle("");
      setBody("");
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 403) {
        setFormError(
          "You must have a completed order for this product to review it."
        );
      } else if (status === 409) {
        setFormError("You have already reviewed this product for that order.");
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const avg =
    data && data.items.length > 0
      ? data.items.reduce((s, r) => s + r.rating, 0) / data.items.length
      : null;

  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
        Customer Reviews
        {data && data.total > 0 && (
          <span className="text-sm font-normal text-gray-500 ms-2">
            ({data.total})
          </span>
        )}
      </h2>

      {avg !== null && (
        <div className="flex items-center gap-3 mb-6">
          <Rating value={avg} size={20} />
          <span className="text-sm text-gray-500">{avg.toFixed(1)} out of 5</span>
        </div>
      )}

      {/* Write review form */}
      {isAuthenticated() && !submitted && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-4"
        >
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Write a Review
          </h3>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Order ID
            </label>
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Paste your Order UUID from My Orders"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Rating
            </label>
            <StarPicker value={rating} onChange={setRating} />
          </div>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Title (optional)
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summarise your experience"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Review <span className="text-xs">(min 20 chars)</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Share your honest experience with this product…"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
            <p className="text-xs text-gray-400 mt-0.5 text-end">
              {body.length}/20 min
            </p>
          </div>

          {formError && (
            <p className="text-sm text-red-500">{formError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {submitting ? "Submitting…" : "Submit Review"}
          </button>
        </form>
      )}

      {submitted && (
        <p className="mb-6 text-sm text-green-600 dark:text-green-400">
          Your review has been submitted. Thank you!
        </p>
      )}

      {/* Review list */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading reviews…</p>
      ) : !data || data.items.length === 0 ? (
        <p className="text-gray-400 text-sm">No reviews yet. Be the first!</p>
      ) : (
        <div className="space-y-4">
          {data.items.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
          {data.pages > 1 && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-40"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-sm text-gray-500">
                {page} / {data.pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ReviewCard({ review }: { review: ReviewResponse }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <Rating value={review.rating} size={14} />
        {review.title && (
          <span className="font-semibold text-sm text-gray-900 dark:text-white">
            {review.title}
          </span>
        )}
      </div>
      {review.body && (
        <p className="text-sm text-gray-700 dark:text-gray-300">{review.body}</p>
      )}
      <p className="text-xs text-gray-400 mt-2">
        {new Date(review.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}
