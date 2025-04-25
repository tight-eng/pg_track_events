import { SQL, sql } from "drizzle-orm";
import {
	integer,
	pgTable,
	varchar,
	timestamp,
	uuid,
	jsonb,
	text,
	index,
	uniqueIndex,
	boolean,
	primaryKey,
	bigserial,
	AnyPgColumn,
	foreignKey,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import type { AdapterAccountType } from "next-auth/adapters"
import { InstallURLOptions } from "@slack/oauth"
import { generateKSUID, KSUID_USER, KSUID_CONNECTION, KSUID_CONNECTION_AUTH_STATE, KSUID_CONNECTION_EVENT, KSUID_CONNECTION_USER, KSUID_SLACK_MESSAGE } from "../../lib/ksuid";

export function lower(email: AnyPgColumn): SQL {
	return sql`lower(${email})`;
}

function ksuid(fieldName: string) {
	// TODO What should the type be?
	return text(fieldName)
}

export const usersTable = pgTable("user", {
	id: ksuid("id")
		.primaryKey()
		.$defaultFn(() => generateKSUID(KSUID_USER)),
	name: text("name"),
	email: text("email"),
	emailVerified: timestamp("email_verified", { mode: "date" }),
	image: text("image"),
	hashedPassword: text("hashed_password"),
	createdAt: timestamp("created_at", { mode: "date" }).notNull().$defaultFn(() => new Date()),
	updatedAt: timestamp("updated_at", { mode: "date" }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
	uniqueEmailIdx: uniqueIndex("unique_email_idx").on(lower(table.email)),
}))

export const authAccountsTable = pgTable(
	"auth_account",
	{
		userId: ksuid("user_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		type: text("type").$type<AdapterAccountType>().notNull(),
		provider: text("provider").notNull(),
		providerAccountId: text("provider_account_id").notNull(),
		refresh_token: text("refresh_token"),
		access_token: text("access_token"),
		expires_at: integer("expires_at"),
		token_type: text("token_type"),
		scope: text("scope"),
		id_token: text("id_token"),
		session_state: text("session_state"),
	},
	(account) => ({
		compositePk: primaryKey({
			columns: [account.provider, account.providerAccountId],
		}),
	})
)

export const authVerificationTokensTable = pgTable(
	"auth_verification_token",
	{
		identifier: text("identifier").notNull(),
		token: text("token").notNull(),
		expires: timestamp("expires", { mode: "date" }).notNull(),
	},
	(verificationToken) => ({
		compositePk: primaryKey({
			columns: [verificationToken.identifier, verificationToken.token],
		}),
	})
)

export const authAuthenticatorsTable = pgTable(
	"auth_authenticator",
	{
		credentialID: text("credential_id").notNull().unique(),
		userId: ksuid("user_id")
			.notNull()
			.references(() => usersTable.id, { onDelete: "cascade" }),
		providerAccountId: text("provider_account_id").notNull(),
		credentialPublicKey: text("credential_public_key").notNull(),
		counter: integer("counter").notNull(),
		credentialDeviceType: text("credential_device_type").notNull(),
		credentialBackedUp: boolean("credential_backed_up").notNull(),
		transports: text("transports"),
	},
	(authenticator) => ({
		compositePk: primaryKey({
			columns: [authenticator.userId, authenticator.credentialID],
		}),
	})
)