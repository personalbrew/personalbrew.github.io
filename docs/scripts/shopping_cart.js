/***** Firebase Initialization *****/
// Replace these with your Firebase project's configuration values.
const db = firebase.firestore();

/***** Global Variables *****/
const availableStock = {};

/* ====================
   Cart Persistence Functions
   ==================== */
function getCart() {
    return JSON.parse(localStorage.getItem('cart')) || {};
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
}


function getShippingCost(country) {
    return shippingCosts[country] || 0;
  }

/* ====================
   Cart UI Functions
   ==================== */
function updateAddToCartButtons() {
  document.querySelectorAll('.product-item').forEach(item => {
    var id = item.getAttribute('data-id');
    var btn = item.querySelector('.add-to-cart');
    if (availableStock[id] !== undefined) {
      if (getCart()[id] && getCart()[id].quantity >= availableStock[id]) {
        btn.disabled = true;
        btn.textContent = "Out of stock";
      } else {
        btn.disabled = false;
        btn.textContent = "Add to cart";
      }
    }
  });
}

/* ====================
   Quantity & Add-to-Cart Functions
   ==================== */
function updateQuantity(productId, change) {
  var cart = getCart();
  if (cart[productId]) {
    var available = availableStock[productId] || Infinity;
    if (change > 0 && cart[productId].quantity >= available) {
      alert("No more stock available for this product.");
      return;
    }
    var newQuantity = cart[productId].quantity + change;
    if (newQuantity > 0) {
      cart[productId].quantity = newQuantity;
    } else {
      delete cart[productId];
    }
    saveCart(cart);
    updateCartUI();
  }
}

function getProductPrice(productId) {
    var productRef = db.collection('inventory').doc(productId);
    productRef.get().then(function(doc) {
      if (doc.exists) {
        var price = doc.data().price;
        alert(price + " price ");
        return price;
      } else {
        console.error("Product " + productId + " not found in inventory.");
      }
    }).catch(function(error) {
      console.error("Error fetching product price:", error);
    });
}

function simpleAddToCart(productId) {
    var cart = getCart();
    if (!cart[productId]) {
      cart[productId] = { product: productId, price: NaN, quantity: 0 };
    }
    var currentQuantity = cart[productId].quantity;
    
    // Check stock via Firebase
    var productRef = db.collection('inventory').doc(productId);
    productRef.get().then(function(doc) {
      if (doc.exists) {
        var currentStock = doc.data().stock;
        availableStock[productId] = currentStock;
        if (currentQuantity < currentStock) {
          cart[productId].quantity = currentQuantity + 1;
          cart[productId].price = doc.data().price;
          saveCart(cart);
        } else {
            alert("Product out of stock. Check the shop!");
        }
      } else {
        console.error("Product " + productId + " not found in inventory.");
      }
    }).catch(function(error) {
      console.error("Error fetching product stock:", error);
    });
  }

function addToCart(productId) {
  var cart = getCart();
  if (!cart[productId]) {
    cart[productId] = { product: productId, price: NaN, quantity: 0 };
  }
  var currentQuantity = cart[productId].quantity;
  
  // Check stock via Firebase
  var productRef = db.collection('inventory').doc(productId);
  productRef.get().then(function(doc) {
    if (doc.exists) {
      var currentStock = doc.data().stock;
      availableStock[productId] = currentStock;
      if (currentQuantity < currentStock) {
        cart[productId].quantity = currentQuantity + 1;
        cart[productId].price = doc.data().price;
        saveCart(cart);
        updateCartUI();
      } else {
        var btn = document.querySelector('.product-item[data-id="' + productId + '"] .add-to-cart');
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Out of stock";
        }
      }
    } else {
      console.error("Product " + productId + " not found in inventory.");
    }
  }).catch(function(error) {
    console.error("Error fetching product stock:", error);
  });
}

/* ====================
   Totals Calculation
   ==================== */
function computeTotals() {
  var cart = getCart();
  var subtotal = 0;
  for (var id in cart) {
    subtotal += cart[id].price * cart[id].quantity;
  }
  // Update subtotal element (optional if computed below)
  document.getElementById('cart-subtotal').textContent = subtotal.toFixed(2) + " €";
  
  var shippingDropdown = document.getElementById('shipping-country');
  var selectedCountry = shippingDropdown ? shippingDropdown.value : "Germany";
  var shippingCost = getShippingCost(selectedCountry);
  
  var couponDiscount = 0;
  var couponLineText = "";
  if (appliedCoupon) {
    var couponAction = appliedCoupon.action;
    if (couponAction === "noshipping") {
      couponDiscount = shippingCost;
      couponLineText = "- " + couponDiscount.toFixed(2) + " € (Shipping)";
    } else if (!isNaN(couponAction)) {
      var percentage = parseFloat(couponAction);
      couponDiscount = subtotal * (percentage / 100);
      couponLineText = "- " + couponDiscount.toFixed(2) + " € (" + percentage + "%)";
    } else if (couponAction.startsWith("p") && couponAction.includes("g")) {
      var match = couponAction.match(/^p(\d+)g(\d+)$/);
      if (match) {
        var X = parseInt(match[1], 10);
        var Y = parseInt(match[2], 10);
        var totalItems = 0;
        for (var id in cart) {
          totalItems += cart[id].quantity;
        }
        if (totalItems >= Y) {
          var prices = [];
          for (var id in cart) {
            var item = cart[id];
            for (var i = 0; i < item.quantity; i++) {
              prices.push(item.price);
            }
          }
          prices.sort((a, b) => a - b);
          var discountCount = Y - X;
          var selected = prices.slice(0, discountCount);
          couponDiscount = selected.reduce((sum, price) => sum + price, 0);
          couponLineText = "- " + couponDiscount.toFixed(2) + " € (p" + X + "g" + Y + ")";
        }
      }
    }
  }
  var finalTotal = subtotal + shippingCost - couponDiscount;
  if (subtotal > 0 && shippingCost >= 0 && finalTotal >= 0) {
    return {
      subtotal: subtotal,
      shippingCost: shippingCost,
      couponDiscount: couponDiscount,
      couponLineText: couponLineText,
      finalTotal: finalTotal,
      selectedCountry: selectedCountry
    };
  } else {
    throw 'Totals wrong: Subtotal=' + subtotal + ';ShippingCost='+shippingCost+';finalTotal='+finalTotal+';couponDiscount='+couponDiscount;
  }
}

/* ====================
   Checkout & PayPal Integration
   ==================== */
function checkoutInventory() {
  var cart = getCart();
  var promises = [];
  for (var id in cart) {
    promises.push(processCartItem(id, cart[id].quantity));
  }
  return Promise.all(promises);
}

function processCartItem(productId, quantity) {
  var productRef = db.collection('inventory').doc(productId);
  return db.runTransaction(function(transaction) {
    return transaction.get(productRef).then(function(doc) {
      if (!doc.exists) {
        throw 'Product ' + productId + ' does not exist.';
      }
      var stock = doc.data().stock;
      if (stock < quantity) {
        throw 'Not enough stock for ' + productId + '. Available: ' + stock;
      }
      transaction.update(productRef, { stock: stock - quantity });
    });
  });
}

