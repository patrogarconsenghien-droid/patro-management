export function createStockHelpers({ products, updateInFirebase, saveToFirebase }) {
  const updateStock = async (productId, quantityChange, reason) => {
    console.log('updateStock appelée avec:', { productId, quantityChange, reason });

    const product = products.find(p => p.id === productId);
    console.log('Produit trouvé:', product);

    if (!product) {
      console.log('Produit non trouvé!');
      return;
    }

    const newStock = Math.max(0, product.stock + quantityChange);
    console.log('Nouveau stock calculé:', newStock);

    try {
      console.log('Mise à jour du produit dans Firebase...');
      await updateInFirebase('products', productId, { stock: newStock });
      console.log('Produit mis à jour avec succès');

      const movement = {
        productId,
        productName: product.name,
        quantityChange,
        newStock,
        reason,
        timestamp: new Date().toISOString()
      };

      console.log('Sauvegarde du mouvement de stock...');
      await saveToFirebase('stockMovements', movement);
      console.log('Mouvement de stock sauvegardé');

    } catch (error) {
      console.error('Erreur mise à jour stock:', error);
      alert('Erreur lors de la mise à jour du stock');
    }
  };

  const getStockStatus = (product) => {
    if (product.stock <= 0) return { color: 'text-red-600', bg: 'bg-red-50' };
    if (product.stock <= product.alertThreshold) return { color: 'text-orange-600', bg: 'bg-orange-50' };
    return { color: 'text-green-600', bg: 'bg-green-50' };
  };

  return { updateStock, getStockStatus };
}
