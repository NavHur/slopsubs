import type { FamilyId, Plan, Promotion } from "#/domain/model";
import type { CapBasis } from "#/domain/recommend";
import { formatDay, formatUsd } from "#/lib/format";
import { UnverifiedPrice } from "../UnverifiedPrice";

const LINK =
	"underline decoration-dotted underline-offset-2 hover:text-fg max-lg:inline-flex max-lg:min-h-11 max-lg:items-center";

/**
 * One plan in a results list. Narrow, it stacks: name and price, the bar, then
 * the detail beside the source links. From 48rem of list width the four parts
 * line up in columns, so cap use reads straight down the list.
 */
export function PlanRow({
	plan,
	basis,
	share,
	shareLabel,
	detail,
	families,
	lead = false,
}: {
	plan: Plan;
	basis: CapBasis;
	/** What the bar fills, 0 to 1: cap used, or the week covered. */
	share: number;
	/** The bar's text equivalent: "73% used", "60% covered". */
	shareLabel: string;
	detail: string;
	/** The models this plan's verdict ran: their promotions are in its figures. */
	families: readonly FamilyId[];
	/** The verdict's plan: its bar takes the accent. */
	lead?: boolean;
}) {
	return (
		<li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3 @3xl:grid-cols-[minmax(0,12rem)_minmax(0,15rem)_minmax(0,1fr)_auto] @3xl:gap-x-6 @3xl:py-2.5">
			<p className="col-span-2 flex flex-wrap items-baseline gap-x-2 @3xl:col-span-1">
				<span className="font-medium">{plan.label}</span>
				<span className="text-[13px] text-muted tabular-nums">
					<UnverifiedPrice plan={plan}>
						{formatUsd(plan.monthlyPriceUsd)}
					</UnverifiedPrice>{" "}
					a month
				</span>
			</p>
			<ShareBar share={share} label={shareLabel} lead={lead} />
			<p className="flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
				<span>{detail}</span>
				<BasisMark basis={basis} />
			</p>
			<SourceLinks plan={plan} />
			<PlanPromotions plan={plan} families={families} />
		</li>
	);
}

/** A plain bar: <meter> paints differently in every browser. */
function ShareBar({
	share,
	label,
	lead,
}: {
	share: number;
	label: string;
	lead: boolean;
}) {
	const width = `${Math.min(Math.max(share, 0), 1) * 100}%`;
	return (
		<div className="col-span-2 flex items-center gap-3 @3xl:col-span-1">
			<div aria-hidden="true" className="h-1 flex-1 rounded-full bg-line">
				<div
					className={`h-full rounded-full ${lead ? "bg-accent" : "bg-subtle"}`}
					style={{ width }}
				/>
			</div>
			<span className="w-[5.5rem] text-[13px] text-muted tabular-nums">
				{label}
			</span>
		</div>
	);
}

/** The cap's footing, drawn as the charts draw it: hollow when estimated. */
function BasisMark({ basis }: { basis: CapBasis }) {
	return (
		<span className="flex items-center gap-1.5 text-[12px] text-subtle">
			<svg aria-hidden="true" width={8} height={8}>
				<circle
					cx={4}
					cy={4}
					r={3.25}
					fill={basis === "estimated" ? "none" : "currentColor"}
					stroke="currentColor"
					strokeWidth={1.5}
				/>
			</svg>
			{`${basis} cap`}
		</span>
	);
}

function capSourceUrl(plan: Plan): string {
	return (
		plan.reportedCap?.url ?? plan.publishedAllowance?.url ?? plan.sourceUrl
	);
}

function SourceLinks({ plan }: { plan: Plan }) {
	const capUrl = capSourceUrl(plan);
	return (
		<p className="justify-self-end text-[13px] whitespace-nowrap text-muted">
			<a
				href={plan.sourceUrl}
				target="_blank"
				rel="noreferrer"
				className={LINK}
			>
				<span className="sr-only">{plan.label} </span>
				{capUrl === plan.sourceUrl ? "Pricing and cap" : "Pricing"}
			</a>
			{capUrl !== plan.sourceUrl && (
				<>
					{" · "}
					<a href={capUrl} target="_blank" rel="noreferrer" className={LINK}>
						<span className="sr-only">{plan.label} </span>
						Cap source
					</a>
				</>
			)}
		</p>
	);
}

/** The promotions on the models this week uses; the plan fits partly on them. */
function promotionsFor(plan: Plan, families: readonly FamilyId[]): Promotion[] {
	return families.flatMap((family) => plan.promotionByFamily[family] ?? []);
}

/** A caveat for each promotion behind a plan's verdict on `families`. */
export function PlanPromotions({
	plan,
	families,
}: {
	plan: Plan;
	families: readonly FamilyId[];
}) {
	return promotionsFor(plan, families).map((promotion) => (
		<PromotionCaveat
			key={promotion.summary}
			plan={plan}
			promotion={promotion}
		/>
	));
}

/** Says the row's figures count a promotion that will end, and where it's from. */
function PromotionCaveat({
	plan,
	promotion,
}: {
	plan: Plan;
	promotion: Promotion;
}) {
	return (
		<p className="col-span-full text-[12px] leading-5 text-subtle">
			<span className="font-medium text-muted">
				Promo until {formatDay(promotion.endsOn)}:
			</span>{" "}
			{promotion.summary}
			{" · "}
			<a href={promotion.url} target="_blank" rel="noreferrer" className={LINK}>
				<span className="sr-only">{plan.label} promotion </span>
				Source
			</a>
		</p>
	);
}
