/**
 * Route Optimization Algorithm
 * 
 * Deterministic nearest-neighbor algorithm for generating cleanup routes
 * - No external APIs required
 * - Reproducible results
 * - Simple and efficient for municipal cleanup planning
 */

interface BinLocation {
    id: string
    lat: number
    lng: number
    riskLevel: string
    overflowScore: number
}

// Haversine distance calculation (same as prediction engine)
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

/**
 * Nearest-Neighbor Algorithm
 * 
 * 1. Start from city center (approximate)
 * 2. From current location, find nearest unvisited bin
 * 3. Move to that bin
 * 4. Repeat until all bins visited
 * 
 * Deterministic: Always produces same route for same input
 */
export function generateNearestNeighborRoute(bins: BinLocation[], startLat?: number, startLng?: number): {
    routeOrder: BinLocation[]
    totalDistanceKm: number
    estimatedDurationMins: number
} {
    if (bins.length === 0) {
        return {
            routeOrder: [],
            totalDistanceKm: 0,
            estimatedDurationMins: 0,
        }
    }

    // Default start: approximate city center (WasteWise service area)
    // Can be customized per city
    let currentLat = startLat || 22.57
    let currentLng = startLng || 88.36

    const visited = new Set<string>()
    const route: BinLocation[] = []
    let totalDistance = 0

    // Nearest neighbor loop
    while (visited.size < bins.length) {
        let nearestBin: BinLocation | null = null
        let nearestDistance = Infinity

        // Find closest unvisited bin
        for (const bin of bins) {
            if (!visited.has(bin.id)) {
                const dist = haversineDistance(currentLat, currentLng, bin.lat, bin.lng)
                if (dist < nearestDistance) {
                    nearestDistance = dist
                    nearestBin = bin
                }
            }
        }

        if (!nearestBin) break

        visited.add(nearestBin.id)
        route.push(nearestBin)
        totalDistance += nearestDistance

        currentLat = nearestBin.lat
        currentLng = nearestBin.lng
    }

    // Estimated duration: ~5 mins per stop + travel time
    // Assume average speed 20 km/h in urban area
    const travelTimeMins = (totalDistance / 20) * 60
    const estimatedDurationMins = Math.ceil(travelTimeMins + route.length * 5)

    return {
        routeOrder: route,
        totalDistanceKm: Math.round(totalDistance * 100) / 100,
        estimatedDurationMins,
    }
}

/**
 * Priority Sort (alternative algorithm)
 * 
 * Sort by:
 * 1. Risk level (CRITICAL first, then HIGH, MEDIUM, LOW)
 * 2. Within same risk level: sort by overflowScore DESC
 * 3. Apply nearest-neighbor within each risk tier
 * 
 * Useful for: "Always hit CRITICAL bins first"
 */
export function generateRiskPrioritySortRoute(bins: BinLocation[]): {
    routeOrder: BinLocation[]
    totalDistanceKm: number
    estimatedDurationMins: number
} {
    const RISK_PRIORITY = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
    }

    // Sort by risk, then by score
    const sorted = [...bins].sort((a, b) => {
        const riskDiff =
            (RISK_PRIORITY[a.riskLevel as keyof typeof RISK_PRIORITY] || 4) -
            (RISK_PRIORITY[b.riskLevel as keyof typeof RISK_PRIORITY] || 4)
        if (riskDiff !== 0) return riskDiff
        return b.overflowScore - a.overflowScore
    })

    return generateNearestNeighborRoute(sorted)
}

/**
 * Mixed Algorithm
 * 
 * 1. Separate bins into risk tiers
 * 2. Apply nearest-neighbor within each tier
 * 3. Concatenate tiers in priority order
 * 
 * Result: Visits all CRITICAL → all HIGH → all MEDIUM → all LOW
 * But within each tier, uses optimal distance
 */
export function generateRiskSegmentedRoute(bins: BinLocation[]): {
    routeOrder: BinLocation[]
    totalDistanceKm: number
    estimatedDurationMins: number
} {
    const RISK_TIERS = {
        critical: [],
        high: [],
        medium: [],
        low: [],
    }

    // Segment bins by risk tier
    for (const bin of bins) {
        const tier = (bin.riskLevel as keyof typeof RISK_TIERS) || 'low'
        RISK_TIERS[tier].push(bin)
    }

    // Build route: CRITICAL → HIGH → MEDIUM → LOW
    let route: BinLocation[] = []
    let totalDistance = 0
    let currentLat = 22.57
    let currentLng = 88.36

    for (const tier of ['critical', 'high', 'medium', 'low'] as const) {
        const tierBins = RISK_TIERS[tier]
        if (tierBins.length === 0) continue

        // Generate nearest neighbor for this tier starting from current location
        const tierRoute = generateNearestNeighborRoute(tierBins, currentLat, currentLng)

        route = route.concat(tierRoute.routeOrder)
        totalDistance += tierRoute.totalDistanceKm

        // Update current location for next tier
        if (tierRoute.routeOrder.length > 0) {
            const lastBin = tierRoute.routeOrder[tierRoute.routeOrder.length - 1]
            currentLat = lastBin.lat
            currentLng = lastBin.lng
        }
    }

    const travelTimeMins = (totalDistance / 20) * 60
    const estimatedDurationMins = Math.ceil(travelTimeMins + route.length * 5)

    return {
        routeOrder: route,
        totalDistanceKm: Math.round(totalDistance * 100) / 100,
        estimatedDurationMins,
    }
}
