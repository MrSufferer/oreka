import { Actor, HttpAgent } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory } from "../declarations/factory/factory.did.js";

// Type for API Results
type ApiResult<T> = {
    ok: T | null;
    err: string | null;
}

// Define interfaces for our contract types
export interface Contract {
    address: Principal;
    created: bigint;
    owner: Principal;
    title: string;
    type: ContractType;
}

export type ContractType =
    | { BinaryOptionMarket: null }
    | { ICRC1Token: null }
    | { Other: null };

export interface DeployParams {
    marketName: string;
    description: string;
    underlying: string;
    expiry: bigint;
    marketType: string;
}

export interface TokenDeployParams {
    name: string;
    symbol: string;
    decimals: number;
    initialSupply: number;
    fee: number;
}

export interface DeployResult {
    ok?: Principal;
    err?: string;
}

/**
 * Helper service for interacting with the Factory canister
 */
export class FactoryApiService {
    private agent: HttpAgent;
    private factoryActor: any;
    private localCanisterId: string = process.env.NEXT_PUBLIC_FACTORY_CANISTER_ID || "bd3sg-teaaa-aaaaa-qaaba-cai";

    constructor(identity?: any) {
        console.log("Initializing FactoryApiService for simplified API with canister ID:", this.localCanisterId);
        console.log("Using host:", process.env.NEXT_PUBLIC_IC_HOST || "http://localhost:4943");
        console.log("Identity provided:", identity ? "Yes" : "No");

        try {
            // Create a fresh agent with the provided identity if available
            this.agent = new HttpAgent({
                host: process.env.NEXT_PUBLIC_IC_HOST || "http://localhost:4943",
                identity: identity
            });

            // Only fetch the root key in development
            if (process.env.NODE_ENV !== 'production') {
                this.agent.fetchRootKey().catch(err => {
                    console.warn('Unable to fetch root key. Check to ensure local replica is running');
                    console.error(err);
                });
            }

            // Create the actor with the updated interface definition
            this.factoryActor = Actor.createActor(idlFactory, {
                agent: this.agent,
                canisterId: this.localCanisterId
            });

            console.log("FactoryApiService initialized successfully with simplified interface");
            if (identity) {
                console.log("Using authenticated identity with principal:", identity.getPrincipal().toString());
            } else {
                console.warn("No identity provided - using anonymous identity");
            }
        } catch (error) {
            console.error("Error initializing FactoryApiService:", error);
            if (error instanceof Error && error.message.includes("&")) {
                console.error("CRITICAL: There's an issue with special characters in the Candid interface definition.");
                console.error("Please ensure all .did files and JS/TS definitions are properly updated.");
            }
            throw error; // Re-throw to allow proper error handling
        }
    }

    /**
     * Update the identity after initialization
     * @param identity The new identity to use
     */
    public updateIdentity(identity: any) {
        if (!identity) {
            console.error("Cannot update identity: No identity provided");
            return;
        }

        console.log("Updating FactoryApiService identity to", identity.getPrincipal().toString());
        this.agent.replaceIdentity(identity);

        // Log the principal that will be used for calls
        console.log("Factory service now using principal:", identity.getPrincipal().toString());
    }

    /**
     * Deploy a new market with DIRECT parameter format:
     * (name: Text, price: Float64, expiry: Nat64, marketType: Number, underlying: Text)
     * Using marketType as a NUMBER (0) instead of string ("CALL_PUT")
     */
    async deployMarket(
        name: string,
        price: number,
        expiry: bigint,
        marketType: number, // Changed from string to number
        underlying: string
    ) {
        try {
            // Validate input parameters
            if (!name || name.trim() === '') {
                return { err: "Market name cannot be empty" };
            }

            // Validate price as a positive number
            if (isNaN(price) || price <= 0) {
                return { err: "Strike price must be a positive number" };
            }

            if (!underlying || underlying.trim() === '') {
                return { err: "Trading pair cannot be empty" };
            }

            console.log("Deploying market with CORRECT parameter types:", {
                name: name,                    // (1) name: Text
                price: price,                  // (2) price: Direct number (float64)
                expiry: expiry.toString(),     // (3) expiry: Nat64 (bigint)
                marketType: marketType,        // (4) marketType: Number (int) - was string, now number!
                underlying: underlying,        // (5) underlying: Text (trading pair)
            });

            try {
                // IMPORTANT: marketType is now a NUMBER (0 for CALL_PUT)
                const result = await this.factoryActor.deployMarket(
                    name,                      // (1) name: Text
                    price,                     // (2) price: Direct number (float64)
                    expiry,                    // (3) expiry: Nat64 (bigint)
                    marketType,                // (4) marketType: Number (int) - was string, now number!
                    underlying                 // (5) underlying: Text (trading pair)
                );
                return result;
            } catch (error) {
                console.error("Deploy actor call error:", error);
                if (error instanceof Error && error.message.includes("IDL")) {
                    return { err: `IDL serialization error: ${error.message}. Try with different parameter types.` };
                }
                throw error; // re-throw to be caught by outer catch block
            }
        } catch (error) {
            console.error("Error deploying market:", error);
            return {
                err: error instanceof Error ? error.message : "Unknown error occurred during market deployment"
            };
        }
    }

    /**
     * Helper method to ensure a number is treated as float64 with decimal places
     * This helps prevent JavaScript from treating whole numbers (like 2700) as integers
     */
    private ensureFloat64(value: number): number {
        // Force decimal representation by adding a tiny amount and then formatting
        // This ensures the number has decimal places and is treated as float64
        const withDecimal = parseFloat(value.toFixed(6));
        console.log(`Ensuring float64: ${value} → ${withDecimal} (type: ${typeof withDecimal})`);
        return withDecimal;
    }

    /**
     * Deploy a new token canister with enhanced error handling
     */
    async deployToken(
        name: string,
        symbol: string,
        decimals: number,
        initialSupply: number,
        fee: number
    ): Promise<DeployResult> {
        try {
            // Input validation
            if (!name || name.trim() === "") {
                return { err: "Token name cannot be empty" };
            }

            if (!symbol || symbol.trim() === "") {
                return { err: "Token symbol cannot be empty" };
            }

            if (decimals < 0 || decimals > 255) {
                return { err: "Decimals must be between 0 and 255" };
            }

            if (initialSupply <= 0) {
                return { err: "Initial supply must be greater than 0" };
            }

            if (fee < 0) {
                return { err: "Fee cannot be negative" };
            }

            console.log(`Deploying token with name: ${name}, symbol: ${symbol}, decimals: ${decimals}, initialSupply: ${initialSupply}, fee: ${fee}`);

            try {
                const result = await this.factoryActor.deployToken(
                    name,
                    symbol,
                    decimals,
                    initialSupply,
                    fee
                );

                console.log("Deploy token result:", result);
                return result;
            } catch (error) {
                console.error("Error deploying token:", error);

                // Enhanced error handling
                if (error instanceof Error) {
                    // Check for common error patterns
                    const errorMsg = error.message;

                    if (errorMsg.includes("cycles")) {
                        return { err: "Insufficient cycles to create token. Please contact the administrator." };
                    }

                    if (errorMsg.includes("decimals")) {
                        return { err: "Invalid decimals value. Please ensure it's between 0 and 255." };
                    }

                    return { err: error.message };
                }

                return { err: "Unknown error occurred during token deployment" };
            }
        } catch (error) {
            console.error("Top-level error during token deployment:", error);
            return {
                err: `Exception during token deployment: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    // Additional API methods
    async getAllContracts(): Promise<ApiResult<any[]>> {
        try {
            console.log("Fetching all contracts from factory");

            // Call the actor method to get all contracts from the factory
            const contracts = await this.factoryActor.getAllContracts();

            console.log("Raw contracts result:", contracts);

            // If we received a valid response
            if (contracts && Array.isArray(contracts)) {
                return {
                    ok: contracts.filter(contract =>
                        contract && contract.type &&
                        ('BinaryOptionMarket' in contract.type || 'ICRC1Token' in contract.type)
                    ),
                    err: null
                };
            } else {
                return { ok: [], err: "No contracts returned from factory" };
            }
        } catch (error) {
            console.error("Error fetching all contracts:", error);
            return { ok: null, err: error instanceof Error ? error.message : "Unknown error" };
        }
    }

    async getContractsByOwner(owner: Principal): Promise<ApiResult<any[]>> {
        try {
            console.log("Fetching contracts for owner:", owner.toString());
            const contracts = await this.factoryActor.getContractsByOwner(owner);
            console.log("Contracts found for owner:", contracts.length);
            return {
                ok: contracts,
                err: null
            };
        } catch (error) {
            console.error("Error fetching contracts by owner:", error);
            return {
                ok: null,
                err: `Failed to fetch contracts by owner: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    async getContractDetails(contractId: Principal): Promise<ApiResult<any>> {
        try {
            console.log("Fetching details for contract:", contractId.toString());

            // The getContractDetails function doesn't exist in the canister
            // Instead, get all contracts and filter for the one with matching ID
            const allContracts = await this.factoryActor.getAllContracts();
            const contract = allContracts.find(
                (contract: any) => contract.address.toString() === contractId.toString()
            );

            if (contract) {
                console.log("Contract found:", contract);
                return {
                    ok: contract,
                    err: null
                };
            } else {
                console.log("Contract not found with ID:", contractId.toString());
                return {
                    ok: null,
                    err: `Contract not found with ID: ${contractId.toString()}`
                };
            }
        } catch (error) {
            console.error("Error fetching contract details:", error);
            return {
                ok: null,
                err: `Failed to fetch contract details: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    async getRecentEvents(): Promise<ApiResult<any[]>> {
        try {
            console.log("Fetching recent deployment events");
            const events = await this.factoryActor.getRecentEvents();
            console.log("Events found:", events.length);
            return {
                ok: events,
                err: null
            };
        } catch (error) {
            console.error("Error fetching recent events:", error);
            return {
                ok: null,
                err: `Failed to fetch recent events: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    async isWasmModuleAvailable(moduleType: string): Promise<ApiResult<boolean>> {
        try {
            console.log("Checking if WASM module is available for type:", moduleType);
            const result = await this.factoryActor.isWasmModuleAvailable(moduleType);
            console.log("WASM module availability result:", result);
            return {
                ok: result,
                err: null
            };
        } catch (error) {
            console.error("Error checking WASM module availability:", error);
            return {
                ok: null,
                err: `Failed to check WASM module availability: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    async refreshWasmModule(moduleType: string): Promise<ApiResult<boolean>> {
        try {
            console.log("Refreshing WASM module for type:", moduleType);
            const result = await this.factoryActor.refreshWasmModule(moduleType);
            console.log("WASM module refresh result:", result);
            return {
                ok: 'ok' in result ? result.ok : false,
                err: 'err' in result ? result.err : null
            };
        } catch (error) {
            console.error("Error refreshing WASM module:", error);
            return {
                ok: null,
                err: `Failed to refresh WASM module: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Deploy a market using a simplified approach with all string parameters
     * to avoid type conversion errors
     */
    async deployMarketSimple(
        name: string,           // Market name (Text)
        price: string,          // Strike price (Text)
        time: string,           // Expiry time (Text)
        pair: string,           // Trading pair (Text)
        type: string            // Market type (Text)
    ): Promise<DeployResult> {
        try {
            // Input validation
            if (!name || name.trim() === "") {
                return { err: "Market name cannot be empty" };
            }

            if (!price || price.trim() === "") {
                return { err: "Strike price cannot be empty" };
            }

            if (!time || time.trim() === "") {
                return { err: "Expiry time cannot be empty" };
            }

            if (!pair || pair.trim() === "") {
                return { err: "Trading pair cannot be empty" };
            }

            if (!type || type.trim() === "") {
                return { err: "Market type cannot be empty" };
            }

            console.log(`Deploying market with all string params: name=${name}, price=${price}, time=${time}, pair=${pair}, type=${type}`);

            try {
                // Convert numeric strings to proper types
                const priceNum = parseFloat(price);
                const timeNum = BigInt(time);
                const typeNum = parseInt(type, 10);

                // Log all parameters with types for debugging
                console.log("Deploy market parameters after conversion:", {
                    name: { value: name, type: typeof name },
                    price: { value: priceNum, type: typeof priceNum },
                    time: { value: timeNum.toString(), type: "bigint" },
                    pair: { value: pair, type: typeof pair },
                    type: { value: typeNum, type: typeof typeNum }
                });

                // Try to find the correct order based on the error messages we've seen
                const result = await this.factoryActor.deployMarket(
                    name,       // name: Text
                    priceNum,   // price: Float64
                    timeNum,    // time: Nat64 (bigint)
                    BigInt(typeNum),    // type: Nat8
                    pair        // pair: Text
                );

                console.log("Deploy market result:", result);
                return result;
            } catch (error) {
                console.error("Error deploying market:", error);

                // Enhanced error handling
                if (error instanceof Error) {
                    // Check for common error patterns
                    const errorMsg = error.message;

                    if (errorMsg.includes("cycles")) {
                        return { err: "Insufficient cycles to create market. Please contact the administrator." };
                    }

                    if (errorMsg.includes("expiry") || errorMsg.includes("time")) {
                        return { err: "Invalid expiry time. Please make sure the expiry time is in the future." };
                    }

                    return { err: error.message };
                }

                return { err: "Unknown error occurred during market deployment" };
            }
        } catch (error) {
            console.error("Top-level error during market deployment:", error);
            return {
                err: `Exception during market deployment: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Try alternative approach for deploying markets with explicit type conversions
     * to address the IDL serialization error
     */
    async deployMarketAlternative(
        name: string,
        price: number,
        expiry: bigint,
        type: bigint,
        pair: string
    ): Promise<DeployResult> {
        try {
            console.log("Trying alternative market deployment approach with explicit type conversions");

            // Validate all parameters first
            if (!name || name.trim() === '') {
                return { err: "Market name cannot be empty" };
            }
            if (isNaN(price) || price <= 0) {
                return { err: "Strike price must be a positive number" };
            }
            if (!pair || pair.trim() === '') {
                return { err: "Trading pair cannot be empty" };
            }

            // Log exact types and values for debugging
            console.log("Parameter types and values:", {
                name: { value: name, type: typeof name },
                price: { value: price, type: typeof price, asString: price.toString() },
                expiry: { value: expiry.toString(), type: "bigint" },
                type: { value: type.toString(), type: "bigint" },
                pair: { value: pair, type: typeof pair }
            });

            // Try to construct the arguments array manually
            const args = [
                { type: 'text', value: name },
                { type: 'float64', value: price },
                { type: 'int', value: expiry },
                { type: 'nat', value: type },
                { type: 'text', value: pair }
            ];

            console.log("Constructed argument array:", args);

            try {
                // Call with an alternative method (depends on specific backend implementation)
                // This is just for debugging purposes
                const result = await this.factoryActor.deployMarket(
                    args[0].value,
                    args[1].value,
                    args[2].value,
                    args[3].value,
                    args[4].value
                );
                return result;
            } catch (error) {
                if (error instanceof Error) {
                    console.error("Error in alternative deployment method:", error.message);

                    // Try to parse out more detailed error information
                    const errorMessage = error.message;

                    if (errorMessage.includes("IDL")) {
                        // Extract detailed IDL error info if available
                        const match = errorMessage.match(/IDL error: ([^\n]+)/);
                        const detailedError = match ? match[1] : errorMessage;
                        return { err: `IDL type error: ${detailedError}` };
                    }

                    return { err: errorMessage };
                }
                return { err: "Unknown error in alternative deployment" };
            }
        } catch (error) {
            console.error("Top-level error in alternative deployment:", error);
            return {
                err: `Exception in alternative deployment: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Troubleshooting method that tries multiple parameter orders to identify 
     * the correct one for deployMarket
     */
    async deployMarketTroubleshoot(
        name: string,
        price: number,
        expiry: bigint,
        type: bigint,
        pair: string
    ): Promise<DeployResult> {
        console.log("Starting troubleshooting market deployment with different parameter orders");

        // Validate parameters first
        if (!name || !pair || isNaN(price) || price <= 0) {
            return { err: "Invalid parameters for troubleshooting" };
        }

        // Different parameter orders to try, based on various interpretations of the Candid interface
        const attempts = [
            {
                name: "Original order (name, price, expiry, type, pair)",
                params: [name, price, expiry, type, pair],
            },
            {
                name: "Order with expiry and type swapped (name, price, type, expiry, pair)",
                params: [name, price, type, expiry, pair],
            },
            {
                name: "Order with string for type (name, price, expiry, type as string, pair)",
                params: [name, price, expiry, type.toString(), pair],
            },
            {
                name: "Order with type as number (name, price, expiry, type as number, pair)",
                params: [name, price, expiry, Number(type), pair],
            },
            {
                name: "Original order with number values converted to strings",
                params: [name, price.toString(), expiry.toString(), type.toString(), pair],
            }
        ];

        for (const attempt of attempts) {
            try {
                console.log(`Trying: ${attempt.name}`);
                console.log("Parameters:", attempt.params);

                // @ts-ignore - we're deliberately trying different parameter types
                const result = await this.factoryActor.deployMarket(...attempt.params);

                console.log("SUCCESS! This parameter order worked:", attempt.name);
                console.log("Result:", result);

                return result;
            } catch (error) {
                console.error(`Failed attempt: ${attempt.name}`, error);
                // Continue to the next attempt
            }
        }

        return { err: "All parameter order attempts failed. Check server logs for details." };
    }

    /**
     * Final attempt with explicit conversions to match Candid interface
     * (text, float64, int, nat, text)
     */
    async deployMarketSimplified(
        name: string,
        price: number,
        expiry: bigint,
        type: bigint,
        pair: string
    ): Promise<DeployResult> {
        try {
            console.log("Trying simplified deployment with explicit type conversions");

            // Convert types explicitly based on the Candid interface
            const nameStr = String(name);                // text
            const priceFloat = Number(price);           // float64
            const expiryInt = expiry;                   // int (already bigint)
            const typeNat = type;                       // nat (already bigint)
            const pairStr = String(pair);               // text

            console.log("Simplified parameters:", {
                nameStr,
                priceFloat,
                expiryInt: expiryInt.toString(),
                typeNat: typeNat.toString(),
                pairStr
            });

            // Make the call with explicit parameters
            console.log("Making canister call with simplified parameters");
            return await this.factoryActor.deployMarket(
                nameStr,
                priceFloat,
                expiryInt,
                // Important: try a regular number instead of bigint for type
                // as the error suggests issue with text parsing, which might be
                // happening if bigint is being converted to string incorrectly
                Number(typeNat),
                pairStr
            );
        } catch (error) {
            console.error("Error in simplified deployment:", error);
            return {
                err: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Try passing all parameters as strings and only the nat64 as a bigint
     * Based on the error message: @deserialize<tttn64t> which suggests
     * the format is (Text, Text, Text, Nat64, Text)
     */
    async deployMarketAllStrings(
        name: string,
        price: number,
        expiry: bigint,
        type: bigint,
        pair: string
    ): Promise<DeployResult> {
        try {
            console.log("Trying to deploy market with all parameters as strings except type");

            // Convert all values to strings except type which remains a bigint
            const nameStr = String(name);
            const priceStr = String(price);
            const expiryStr = String(expiry);
            const typeNat = type;  // Keep as bigint
            const pairStr = String(pair);

            console.log("Parameters for all-strings approach:", {
                nameStr,
                priceStr,
                expiryStr,
                typeNat: typeNat.toString(),
                pairStr
            });

            // @ts-ignore - deliberately passing strings to match expected format
            const result = await this.factoryActor.deployMarket(
                nameStr,     // Text
                priceStr,    // Text
                expiryStr,   // Text
                typeNat,     // Nat64 (bigint)
                pairStr      // Text
            );

            return result;
        } catch (error) {
            console.error("Error with all-strings approach:", error);
            return {
                err: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Final attempt using low-level Actor.call with explicit argument array
     * to bypass serialization issues. 
     */
    async deployMarketDirectCall(
        name: string,
        price: number,
        expiry: bigint,
        type: bigint,
        pair: string
    ): Promise<DeployResult> {
        try {
            console.log("Attempting direct Actor.call with explicit argument construction");

            // Create argument array with explicit types
            const args = [
                { type: 'text', value: name },
                { type: 'text', value: String(price) },
                { type: 'text', value: String(expiry) },
                { type: 'nat64', value: type },  // The only non-text parameter
                { type: 'text', value: pair }
            ];

            console.log("Direct call arguments:", args);

            // Use Actor.call method to make a lower-level call
            try {
                // @ts-ignore - we're using a lower-level call method
                const result = await this.factoryActor.constructor.call(
                    this.factoryActor,
                    "deployMarket",
                    args
                );

                console.log("Direct call result:", result);
                return result;
            } catch (error) {
                console.error("Error in direct actor call:", error);
                if (error instanceof Error) {
                    return { err: `Direct call error: ${error.message}` };
                }
                return { err: "Unknown error in direct call" };
            }
        } catch (error) {
            console.error("Top-level error in direct call approach:", error);
            return {
                err: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Brute force attempt that tries all possible combinations of parameter types
     */
    async deployMarketBruteForce(
        name: string,
        price: number,
        expiry: bigint,
        type: bigint,
        pair: string
    ): Promise<DeployResult> {
        console.log("Starting brute force parameter type combinations");

        // Create different representations of each parameter
        const nameVariants = [name, String(name)];
        const priceVariants = [price, String(price), price.toFixed(2)];
        const expiryVariants = [expiry, Number(expiry), String(expiry)];
        const typeVariants = [type, Number(type), String(type), 1];
        const pairVariants = [pair, String(pair)];

        // Try several different parameter combinations based on the error message patterns
        const attempts = [
            // From backtrace @deserialize<tttn64t> - (Text, Text, Text, Nat64, Text)
            {
                name: "All text except nat64 (tttn64t)",
                params: [String(name), String(price), String(expiry), type, String(pair)]
            },

            // Tweaking the nat64 position - maybe it's the 3rd parameter?
            {
                name: "All text with nat64 in 3rd position",
                params: [String(name), String(price), type, String(expiry), String(pair)]
            },

            // Original schema with primitive types
            {
                name: "Original order with primitive types",
                params: [name, price, expiry, type, pair]
            },

            // What if type is actually a number not bigint?
            {
                name: "With type as regular number",
                params: [name, price, expiry, Number(type), pair]
            },

            // Try reversing pair and type
            {
                name: "Reversed pair and type",
                params: [name, price, expiry, pair, type]
            }
        ];

        for (const attempt of attempts) {
            try {
                console.log(`Trying: ${attempt.name}`);
                console.log("Parameters:", attempt.params);

                // @ts-ignore - we're deliberately trying different parameter types
                const result = await this.factoryActor.deployMarket(...attempt.params);

                console.log("SUCCESS! This parameter combination worked:", attempt.name);
                console.log("Result:", result);

                return result;
            } catch (error) {
                console.error(`Failed attempt: ${attempt.name}`, error);
                // Continue to the next attempt
            }
        }

        // If all pre-defined attempts fail, try brute force combinations
        console.log("Trying systematic brute force combinations");
        let attemptCount = 0;
        const maxAttempts = 20; // Limit to avoid excessive API calls

        for (const nameVar of nameVariants) {
            for (const priceVar of priceVariants) {
                for (const expiryVar of expiryVariants) {
                    for (const typeVar of typeVariants) {
                        for (const pairVar of pairVariants) {
                            attemptCount++;
                            if (attemptCount > maxAttempts) {
                                console.log("Reached maximum brute force attempts");
                                return { err: "Exhausted all parameter combinations without success" };
                            }

                            try {
                                console.log(`Brute force attempt #${attemptCount}`, {
                                    nameVar, priceVar, expiryVar, typeVar, pairVar
                                });

                                // @ts-ignore - we're deliberately trying different parameter types
                                const result = await this.factoryActor.deployMarket(
                                    nameVar, priceVar, expiryVar, typeVar, pairVar
                                );

                                console.log(`SUCCESS! Brute force attempt #${attemptCount} worked`);
                                console.log("Result:", result);

                                return result;
                            } catch (error) {
                                console.error(`Failed brute force attempt #${attemptCount}`, error);
                                // Continue to the next attempt
                            }
                        }
                    }
                }
            }
        }

        return { err: "All parameter combinations failed. Please check server logs for details." };
    }

    /**
     * Get direct access to the factory actor for advanced usage
     */
    public getFactoryActor() {
        return this.factoryActor;
    }

    /**
     * Deploy a market with the correct parameter types
     * (Text, Float64, Text, Nat64, Text)
     */
    async deployMarketWithStrings(
        name: string,           // Text (1)
        priceAsString: string,  // Will be converted to float64 (2)
        underlyingPair: string, // Text (3)
        expiry: bigint,         // Nat64 (4)
        marketTypeStr: string   // Text (5)
    ): Promise<DeployResult> {
        try {
            // Convert the price string to a float64 number
            const priceAsFloat = parseFloat(priceAsString);

            if (isNaN(priceAsFloat) || priceAsFloat <= 0) {
                return { err: "Strike price must be a positive number" };
            }

            console.log("Deploying market with fixed parameter order:", {
                name: name,                    // (1) Text
                price: priceAsFloat,           // (2) Float64 (number)
                underlying: underlyingPair,    // (3) Text
                expiry: expiry.toString(),     // (4) Nat64 (bigint)
                marketType: marketTypeStr      // (5) Text
            });

            try {
                // Call the backend with the CORRECT parameter order
                return await this.factoryActor.deployMarket(
                    name,            // (1) Text
                    priceAsFloat,    // (2) Float64 (number)
                    expiry,          // (4) Nat64 (bigint)
                    marketTypeStr    // (5) Text
                );
            } catch (error) {
                console.error("Error with parameter types:", error);
                return { err: `Error with parameter types: ${error instanceof Error ? error.message : String(error)}` };
            }
        } catch (error) {
            console.error("Top-level error in deployment:", error);
            return {
                err: `Exception in deployment: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Deploy a market with the final parameters needed by the backend
     * This is the main method that should be used for market deployment
     */
    async deployMarketFinal(
        name: string,
        strike_price: number,
        expiry: bigint,
        trading_pair: string = "BTC-USD" // Default trading pair if not specified
    ): Promise<DeployResult> {
        try {
            console.log(`[deployMarketFinal] Starting deployment with params:`, {
                name,
                strike_price,
                expiry: expiry.toString(),
                trading_pair
            });

            // Input validation
            if (!name || name.trim() === '') {
                console.error("[deployMarketFinal] Market name is empty");
                return { err: "Market name cannot be empty" };
            }

            if (isNaN(strike_price) || strike_price <= 0) {
                console.error("[deployMarketFinal] Invalid strike price:", strike_price);
                return { err: "Strike price must be positive" };
            }

            if (!trading_pair || trading_pair.trim() === '') {
                console.error("[deployMarketFinal] Trading pair is empty");
                return { err: "Trading pair cannot be empty" };
            }

            // Ensure the strike price is a proper float64
            const safeStrikePrice = this.ensureFloat64(strike_price);
            console.log(`[deployMarketFinal] Safe strike price: ${safeStrikePrice} (type: ${typeof safeStrikePrice})`);

            // Direct call to the backend deployMarket function
            console.log(`[deployMarketFinal] Calling factory.deployMarket with:`, {
                name,
                strike_price: safeStrikePrice,
                expiry: expiry.toString(),
                trading_pair
            });

            try {
                // Using null-checking pattern to handle potential undefined result
                const result = await this.factoryActor.deployMarket(
                    name,
                    safeStrikePrice,
                    expiry,
                    trading_pair
                );

                console.log("[deployMarketFinal] Backend response:", result);

                if (result === undefined || result === null) {
                    console.error("[deployMarketFinal] Backend returned null/undefined result");
                    return { err: "Backend returned an empty response" };
                }

                if ('ok' in result) {
                    console.log(`[deployMarketFinal] Market deployed successfully:`, result.ok.toString());
                    return { ok: result.ok };
                } else if ('err' in result) {
                    console.error(`[deployMarketFinal] Error from backend:`, result.err);
                    return { err: result.err };
                } else {
                    console.error(`[deployMarketFinal] Unexpected result format:`, result);
                    return { err: "Unexpected response format from backend" };
                }
            } catch (callError) {
                console.error("[deployMarketFinal] Error during actor call:", callError);

                if (callError instanceof Error) {
                    // Provide more detailed error info based on error type
                    if (callError.message.includes("RejectedByCanister")) {
                        return { err: "Canister rejected the call: " + callError.message };
                    } else if (callError.message.includes("type")) {
                        return { err: "Type error: " + callError.message };
                    }
                    return { err: "Actor call error: " + callError.message };
                }

                return { err: "Unknown error during actor call" };
            }
        } catch (error) {
            console.error("[deployMarketFinal] Unexpected error:", error);
            return {
                err: error instanceof Error
                    ? `Unexpected error: ${error.message}`
                    : "Unknown error occurred during market deployment"
            };
        }
    }

    /**
     * Get all market details including trading pairs and strike prices
     */
    async getAllMarketDetails(): Promise<ApiResult<any[]>> {
        try {
            console.log("Fetching all market details...");
            const result = await this.factoryActor.getAllMarketDetails();
            console.log("Raw market details result:", result);

            // Process the returned data to ensure proper formatting
            const processedResult = result.map((market: any) => {
                // Ensure proper handling of optional values
                const strikePrice = market.strikePrice && market.strikePrice.length > 0
                    ? market.strikePrice[0]
                    : null;

                const tradingPair = market.tradingPair && market.tradingPair.length > 0
                    ? market.tradingPair[0]
                    : null;

                // Log the values for debugging
                console.log(`Market ${market.canisterId.toString()}: Strike price = ${strikePrice}, Trading pair = ${tradingPair}`);

                return {
                    ...market,
                    strikePrice: strikePrice,
                    tradingPair: tradingPair
                };
            });

            console.log("Processed market details:", processedResult);
            return { ok: processedResult, err: null };
        } catch (error) {
            console.error("Error fetching market details:", error);
            console.error("Error details:", JSON.stringify(error, null, 2));
            return {
                ok: null,
                err: error instanceof Error ? error.message : "Unknown error fetching market details"
            };
        }
    }

    /**
     * Get all market strike prices - efficient batch query
     */
    async getMarketStrikePrices(): Promise<ApiResult<Map<string, number>>> {
        try {
            console.log("Fetching all market strike prices...");
            const result = await this.factoryActor.getMarketStrikePrices();
            console.log("Raw market strike prices result:", JSON.stringify(result, null, 2));

            // Convert the array of pairs to a Map
            const strikePricesMap = new Map<string, number>();

            result.forEach((pair: any) => {
                const [canisterId, strikePrice] = pair;

                // Debug the values
                console.log(`Processing pair: canisterId = ${canisterId.toString()}, strikePrice =`, strikePrice);

                if (strikePrice && strikePrice.length > 0) {
                    // Handle optional values correctly
                    const price = strikePrice[0];
                    console.log(`Found price ${price} for canister ${canisterId.toString()}`);
                    if (typeof price === 'number' && !isNaN(price)) {
                        strikePricesMap.set(canisterId.toString(), price);
                    }
                } else {
                    console.log(`No price found for canister ${canisterId.toString()}`);
                }
            });

            console.log("Final strike prices map:", Object.fromEntries(strikePricesMap));
            return { ok: strikePricesMap, err: null };
        } catch (error) {
            console.error("Error fetching market strike prices:", error);
            console.error("Error details:", JSON.stringify(error, null, 2));
            return {
                ok: null,
                err: error instanceof Error ? error.message : "Unknown error fetching market strike prices"
            };
        }
    }

    /**
     * Get details for a specific market by ID
     */
    async getMarketDetails(canisterId: string): Promise<ApiResult<any>> {
        try {
            console.log(`Fetching details for market ${canisterId}...`);
            const principal = Principal.fromText(canisterId);
            const result = await this.factoryActor.getMarketDetails(principal);
            console.log("Market details result:", result);
            return { ok: result, err: null };
        } catch (error) {
            console.error(`Error fetching market details for ${canisterId}:`, error);
            return {
                ok: null,
                err: error instanceof Error ? error.message : `Unknown error fetching market details for ${canisterId}`
            };
        }
    }

    /**
     * Debug method to test Candid serialization for parameters
     * This should help identify issues with special characters
     */
    debugSerialize(params: any[]): string {
        try {
            // Attempt to serialize to JSON and then back
            const jsonString = JSON.stringify(params);
            console.log("Serialized to JSON:", jsonString);

            // Check for special character issues
            if (jsonString.includes("&")) {
                console.warn("WARNING: JSON contains '&' character which might cause issues");
            }

            // Try to parse back
            const parsed = JSON.parse(jsonString);
            console.log("Parsed from JSON:", parsed);

            return "Serialization successful";
        } catch (error) {
            console.error("Serialization error:", error);
            return `Serialization error: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    /**
     * List all deployed markets, formatted for the frontend
     * This is a wrapper around getAllContracts to match what the ListMarkets component expects
     */
    async listMarkets(): Promise<ApiResult<any[]>> {
        try {
            console.log("Listing all markets via getAllContracts");
            const result = await this.getAllContracts();

            if (result.ok) {
                // Format contracts as markets for the frontend
                const markets = result.ok.map(contract => {
                    // Filter only binary option markets if needed
                    if ('contractType' in contract &&
                        typeof contract.contractType === 'object' &&
                        'BinaryOptionMarket' in contract.contractType) {

                        return {
                            name: contract.name || "Unnamed Market",
                            market_type: "Binary Option",
                            canister_id: contract.canisterId?.toString() || contract.address?.toString()
                        };
                    }
                }).filter(Boolean);

                console.log("Transformed markets for frontend:", markets);
                return {
                    ok: markets,
                    err: null
                };
            }

            return result;
        } catch (error) {
            console.error("Error listing markets:", error);
            return {
                ok: null,
                err: `Failed to list markets: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Start the trading phase for a market (allows the factory to call on behalf of the owner)
     * This bypasses authentication issues by letting the factory canister make the call
     * @param canisterId The ID of the market canister to start trading on
     */
    async startTrading(canisterId: string): Promise<ApiResult<boolean>> {
        try {
            console.log(`Calling startTrading on market canister ${canisterId} via factory`);

            // Call the specific market's startTrading method through the factory
            const result = await this.factoryActor.startTradingForMarket(
                Principal.fromText(canisterId)
            );

            console.log("startTrading result:", result);

            if ('ok' in result) {
                return {
                    ok: true,
                    err: null
                };
            } else {
                return {
                    ok: false,
                    err: 'err' in result ? result.err : "Unknown error starting trading"
                };
            }
        } catch (error) {
            console.error("Error starting trading:", error);
            return {
                ok: false,
                err: `Failed to start trading: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
}