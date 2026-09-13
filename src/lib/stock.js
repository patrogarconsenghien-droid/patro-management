import { increment } from 'firebase/firestore';

export function createStockHelpers({ products, updateInFirebase, saveToFirebase }) {
  /**
   * Ajoute (ou retire, si négatif) des unités au stock d'un produit.
   *
   * L'écriture se fait par incrément côté serveur : chaque changement
   * s'additionne au stock réel en base. Avant, on écrivait « stock affiché +
   * changement » : deux ventes rapprochées (ou deux téléphones au bar)
   * partaient du même stock affiché, et la seconde écrasait la première.
   * Contrairement à une transaction, l'incrément fonctionne aussi hors ligne.
   *
   * Renvoie true si le stock a été mis à jour.
   */
  const updateStock = async (productId, quantityChange, reason) => {
    const product = products.find(p => p.id === productId);
    const change = Number(quantityChange);

    if (!product) {
      console.error('updateStock : produit introuvable', productId);
      return false;
    }
    if (!Number.isFinite(change) || change === 0) {
      console.error('updateStock : changement de stock invalide', quantityChange);
      return false;
    }

    try {
      await updateInFirebase('products', productId, { stock: increment(change) });

      await saveToFirebase('stockMovements', {
        productId,
        productName: product.name,
        quantityChange: change,
        // Estimation à partir du stock affiché : le stock réel est celui en base.
        newStock: (Number(product.stock) || 0) + change,
        reason,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Erreur mise à jour stock:', error);
      alert('Erreur lors de la mise à jour du stock');
      return false;
    }
  };

  const getStockStatus = (product) => {
    if (product.stock <= 0) return { color: 'text-red-600', bg: 'bg-red-50' };
    if (product.stock <= product.alertThreshold) return { color: 'text-orange-600', bg: 'bg-orange-50' };
    return { color: 'text-green-600', bg: 'bg-green-50' };
  };

  return { updateStock, getStockStatus };
}
