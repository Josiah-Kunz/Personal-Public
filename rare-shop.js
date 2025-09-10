/**
	JS script to allow for stocked items.
	
	Usage:
	
		game => {

			const scriptUrl = "https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/1bf1556c583eadbf31c4a8ffb299fd5216c455a5/excello-lighting-injection.js";
			const scriptName = scriptUrl.split('/').pop().split('.')[0];

			fetch(scriptUrl)
			.then(response => response.text())
			.then(scriptText => {
				eval(scriptText);
			}) 
			.catch(error => console.error(`Failed to load ${scriptName}:`, error));

		}
	
	...and of course change the rareItemStocks settings in this script. Once 
	you do that, this script can be used globally (that is, imported on every 
	map with a shop).
	
	The player purchases items one-by-one and is useful for rare items, such 
	as Leftovers. In its current state, it hypothetically supports custom 
	currenty, but in practice has not been tested. It is not recommended to use
	it with currency yet.
*/

// ============================================================================
// Settings
// ============================================================================

rareItemMax = {
	"06idcypk" : 3
}

// ============================================================================
// Represents a special item that has a purchase cap
// ============================================================================
class RareItem {
	
	constructor(uid, maxAmount = 1) {
		this.uid = uid;
		this.maxAmount = maxAmount;
		this.cachedAmount = game.map.eventVars["Purchased_" + uid] || 0;
	}

	// Check if the item can still be purchased
	canPurchase() {
		return this.cachedAmount < this.maxAmount;
	}

	// Refresh cached purchase count from eventVars
	refreshCache() {
		this.cachedAmount = game.map.eventVars["Purchased_" + this.uid] || 0;
	}
}

// Build rare item objects from settings
let rareItems = Object.entries(rareItemMax).map(
	([uid, maxAmount]) => new RareItem(uid, maxAmount)
);
let rareItemUIDs = rareItems.map(item => item.uid);

// ============================================================================
// Function Definitions
// ============================================================================

// Return only items that are still purchasable
function filterPurchasableItems(items) {
	return items.filter(([item]) => {
		if (rareItemUIDs.includes(item.uid)) {
			let rareItem = rareItems.find(rareItem => rareItem.uid === item.uid);
			return rareItem.canPurchase();
		}
		return true;
	});
}

// Get the player’s current money, accounting for currencies
function getCurrentMoney(shop) {
	return shop.currency
		? (shop.itemCurrency
			? shop.game.player.bag.getAmount(shop.currency)
			: shop.game.map.eventVars[shop.currency] || 0)
		: shop.game.player.bag.money;
}

// Temporarily override money/currency so the purchase system runs
function overrideFunds(shop, itemPrice) {
	let originalMoney = shop.game.player.bag.money;
	let originalCurrencyAmount;

	if (shop.currency) {
		if (shop.itemCurrency) {
			originalCurrencyAmount = shop.game.player.bag.getAmount(shop.currency);
			shop.game.player.bag.setAmount(shop.currency, itemPrice);
		} else {
			originalCurrencyAmount = shop.game.map.eventVars[shop.currency] || 0;
			shop.game.map.eventVars[shop.currency] = itemPrice;
		}
	} else {
		shop.game.player.bag.money = itemPrice;
	}

	return { originalMoney, originalCurrencyAmount };
}

// Restore funds after purchase system finishes
function restoreFunds(shop, originalMoney, originalCurrencyAmount) {
	if (shop.currency) {
		if (shop.itemCurrency) {
			shop.game.player.bag.setAmount(shop.currency, originalCurrencyAmount);
		} else {
			shop.game.map.eventVars[shop.currency] = originalCurrencyAmount;
		}
	} else {
		shop.game.player.bag.money = originalMoney;
	}
}

// Hook into textbox "Yes" answer to increment purchase count
function hookTextboxYes(game, itemUID, rareItem, originalAnswers) {
	game.textbox.answers = (arr) => {
		if (arr && arr[0] && arr[0][0] === "Yes") {
			let originalYesCallback = arr[0][1];
			arr[0][1] = () => {
				let result = originalYesCallback();
				console.log("RESULT:");
				console.log(result);

				// Increment purchase count on success
				// Sometimes this triggers twice in a row, hence the timeout
				game.map.mapVars["Purchased_" + itemUID] = rareItem.cachedAmount + 1;
				setTimeout(() => {
					let newCount = game.map.mapVars["Purchased_" + itemUID];
					rareItem.cachedAmount = newCount;
					game.trigger("ev[Purchased_" + itemUID + "]=" + newCount);
				}, 100);

				return result;
			};
		}
		game.textbox.answers = originalAnswers;
		return originalAnswers.call(game.textbox, arr);
	};
}

// ============================================================================
// Shop Class Overrides
// ============================================================================

// Override shop.open to filter out unavailable rare items
// This runs the first time a shop is opened
const originalOpen = game.shop.open;
game.shop.open = function(itemList, selling, s, i, a) {
	const result = originalOpen.call(this, itemList, selling, s, i, a);

	rareItems.forEach(item => item.refreshCache());
	this.items = filterPurchasableItems(this.items);

	return result;
};

// Override shop.showItem with same filtering logic
// This runs post-purchase
const originalShowItem = game.shop.showItem;
game.shop.showItem = function(t, e) {
	rareItems.forEach(item => item.refreshCache());
	this.items = filterPurchasableItems(this.items);

	return originalShowItem.call(this, t, e);
};

// Override shop.input to enforce rare item purchase rules
// This triggers on "action", or when a selection is made
const originalInput = game.shop.input;
game.shop.input = function(t, e) {
	if ((t === "action" || this.game.input.keyPressed("action")) && !this.selling) {
		let i = this.items[this.selected];

		// If no valid item selected, fallback to original
		if (!i || !i[0].uid) return originalInput.call(this, t, e);

		let itemUID = i[0].uid;
		let itemPrice = i[1];

		// Handle rare item purchase logic
		if (rareItemUIDs.includes(itemUID)) {
			let rareItem = rareItems.find(r => r.uid === itemUID);
			rareItem.refreshCache();

			if (!rareItem.canPurchase()) return;

			let currentMoney = getCurrentMoney(this);
			if (currentMoney < itemPrice) return originalInput.call(this, t, e);

			let { originalMoney, originalCurrencyAmount } = overrideFunds(this, itemPrice);
			hookTextboxYes(this.game, itemUID, rareItem, this.game.textbox.answers);

			originalInput.call(this, t, e);
			restoreFunds(this, originalMoney, originalCurrencyAmount);

			return;
		}
	}

	// Default behavior if not a rare item purchase
	return originalInput.call(this, t, e);
};
