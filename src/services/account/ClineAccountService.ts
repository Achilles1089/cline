/**
 * Dappit AI — Account Service (No-Op Stub)
 *
 * Cline account/billing features are not used in Dappit.
 * This stub preserves the API surface for import compatibility.
 */
import type {
	BalanceResponse,
	OrganizationBalanceResponse,
	OrganizationUsageTransaction,
	PaymentTransaction,
	UsageTransaction,
	UserResponse,
} from "@shared/ClineAccount"

export class ClineAccountService {
	private static instance: ClineAccountService

	public static getInstance(): ClineAccountService {
		if (!ClineAccountService.instance) {
			ClineAccountService.instance = new ClineAccountService()
		}
		return ClineAccountService.instance
	}

	get baseUrl(): string {
		return ""
	}

	async fetchBalanceRPC(): Promise<BalanceResponse | undefined> {
		return undefined
	}

	async fetchUsageTransactionsRPC(): Promise<UsageTransaction[] | undefined> {
		return undefined
	}

	async fetchPaymentTransactionsRPC(): Promise<PaymentTransaction[] | undefined> {
		return undefined
	}

	async fetchMe(): Promise<UserResponse | undefined> {
		return undefined
	}

	async fetchUserOrganizationsRPC(): Promise<UserResponse["organizations"] | undefined> {
		return undefined
	}

	async fetchOrganizationCreditsRPC(_organizationId: string): Promise<OrganizationBalanceResponse | undefined> {
		return undefined
	}

	async fetchOrganizationUsageTransactionsRPC(
		_organizationId: string,
	): Promise<OrganizationUsageTransaction[] | undefined> {
		return undefined
	}

	async switchAccount(_organizationId?: string): Promise<void> {
		// No-op
	}
}
