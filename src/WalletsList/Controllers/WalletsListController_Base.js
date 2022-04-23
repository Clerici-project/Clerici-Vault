'use strict'

import ListBaseController from '../../Lists/Controllers/ListBaseController'
import Wallet from '../../Wallets/Models/Wallet'

const blue_hexColorString = '#00C6FF'
const hexColorStrings =
[
  '#6B696B', // dark grey
  '#CFCECF', // light grey
  '#00F4CD', // teal
  '#D975E1', // purple
  '#F97777', // salmon/red
  '#EB8316', // orange
  '#EACF12', // yellow
  blue_hexColorString // blue
]
//
class WalletsListController extends ListBaseController {
  constructor (options, context) {
    super(options, context)
  }

  //
  // Runtime - Delegation - Post-instantiation hook
  RuntimeContext_postWholeContextInit_setup () {
    super.RuntimeContext_postWholeContextInit_setup()
    const self = this
    {
      const emitter = self.context.settingsController
      emitter.on(
        emitter.EventName_settingsChanged_specificAPIAddressURLAuthority(),
        function () {
          self.settingsChanged_specificAPIAddressURLAuthority()
        }
      )
    }
  }

  //
  //
  // Overrides - ListBaseController
  //
  override_CollectionName () {
    return 'Wallets'
    // return wallet_persistence_utils.CollectionName -- commented out because we're debugging runtime context: TODO: make this dynamic?
  }

  override_lookup_RecordClass () {
    return Wallet
  }

  override_booting_reconstituteRecordInstanceOptionsWithBase (
    optionsBase, // _id is already supplied in this
    persistencePassword,
    forOverrider_instance_didBoot_fn,
    forOverrider_instance_didFailBoot_fn
  ) {
    const self = this
    // now supply actual Wallet callbacks
    optionsBase.failedToInitialize_cb = function (err, returnedInstance) {
      console.error('Failed to initialize wallet ', err, returnedInstance)
      forOverrider_instance_didFailBoot_fn(err, returnedInstance)
    }
    optionsBase.successfullyInitialized_cb = function (returnedInstance) {
      returnedInstance.Boot_decryptingExistingInitDoc( // this will also handle recovering wallets which failed to log in (such as on change to faulty server/URL)
        persistencePassword,
        function (err) {
          forOverrider_instance_didBoot_fn(err, returnedInstance)
        }
      )
    }
    optionsBase.didReceiveUpdateToAccountInfo = function () {} // TODO: bubble?
    optionsBase.didReceiveUpdateToAccountTransactions = function () {} // TODO: bubble?
  }

  overridable_shouldSortOnEveryRecordAdditionAtRuntime () {
    return true
  }

  overridable_finalizeAndSortRecords (fn) // () -> Void; must call this!
  {
    const self = this
    // do not call on `super` of fn could be called redundantly
    self.records = self.records.sort(
      function (a, b) { // sorting specifically by date added with new additions at the end
        return a.dateWalletFirstSavedLocally - b.dateWalletFirstSavedLocally
      }
    )
    fn() // ListBaseController overriders must call this!
  }

  //
  //
  // Booting/Booted - Accessors - Public - Events emitted
  //
  EventName_aWallet_balanceChanged () {
    return 'EventName_aWallet_balanceChanged'
  }

  EventName_aWallet_transactionsAdded () {
    return 'EventName_aWallet_transactionsAdded'
  }

  //
  //
  // Runtime - Accessors - Private - Factories - Properties
  //
  _new_autogeneratedWalletLabel () {
    const self = this
    if (self.records.length == 0) {
      return 'My First Wallet'
    }
    return 'Untitled Wallet' // TODO: maybe pick from a list of funny/apt names, e.g. "Savings", "Piggy Bank", etc
  }

  //
  //
  // Booted - Accessors - Public
  //
  GivenBooted_SwatchesInUse () {
    const self = this
    if (self.hasBooted !== true) {
      console.warn('GivenBooted_SwatchesInUse called when ' + self.constructor.name + ' not yet booted.')
      return [] // this may be for the first wallet creation - let's say nothing in use yet
    }
    const inUseSwatches = []
    {
      self.records.forEach(
        function (wallet, i) {
          const swatch = wallet.swatch
          if (typeof swatch !== 'undefined' && swatch) {
            inUseSwatches.push(swatch)
          }
        }
      )
    }
    return inUseSwatches
  }

  All_SwatchHexColorStrings () {
    return hexColorStrings
  }

  BlueSwatchHexColorString () {
    return blue_hexColorString
  }

  IsSwatchHexColorStringADarkColor (hexColorString) {
    switch (hexColorString) {
      case '#6B696B': // dark grey
        return true
      default:
        return false
    }
  }

  //
  //
  // Booted - Imperatives - Public - Wallets list
  //
  CreateNewWallet_NoBootNoListAdd (
    fn, // fn: (err: Error?, walletInstance: Wallet) -> Void
    optl_locale_code
  ) { // call this first, then call WhenBooted_ObtainPW_AddNewlyGeneratedWallet
    const self = this
    const context = self.context
    const options =
		{
		  generateNewWallet: true, // must flip this flag to true
		  //
		  failedToInitialize_cb: function (err, walletInstance) {
		    fn(err)
		  },
		  successfullyInitialized_cb: function (walletInstance) {
		    fn(null, walletInstance)
		  },
		  //
		  didReceiveUpdateToAccountInfo: function () { // TODO: bubble? have to know it's in list first
		  },
		  didReceiveUpdateToAccountTransactions: function () { // TODO: bubble? have to know it's in list first
		  }
		}
    if (optl_locale_code && typeof optl_locale_code !== 'undefined') {
      options.locale_code = optl_locale_code
    }
    const wallet = new Wallet(options, context)
  }

  WhenBooted_ObtainPW_AddNewlyGeneratedWallet (
    walletInstance,
    walletLabel,
    swatch,
    fn, // fn: (err: Error?, walletInstance: Wallet) -> Void
    optl__userCanceledPasswordEntry_fn
  ) {
    console.log('WalletsListControllerBase: WhenBooted_ObtainPW_AddNewlyGeneratedWallet invoked')
    const userCanceledPasswordEntry_fn = optl__userCanceledPasswordEntry_fn || function () {}
    const self = this
    const context = self.context
    self.ExecuteWhenBooted(
      function () {
        context.passwordController.WhenBootedAndPasswordObtained_PasswordAndType( // this will block until we have access to the pw
          function (obtainedPasswordString, userSelectedTypeOfPassword) {
            _proceedWithPassword(obtainedPasswordString)
          },
          function () { // user canceled
            userCanceledPasswordEntry_fn()
          }
        )
        function _proceedWithPassword (persistencePassword) {
          walletInstance.Boot_byLoggingIn_givenNewlyCreatedWallet(
            persistencePassword,
            walletLabel,
            swatch,
            function (err) {
              if (err) {
                fn(err)
                return
              }
              self._atRuntime__record_wasSuccessfullySetUpAfterBeingAdded(walletInstance)
              //
              fn(null, walletInstance)
            }
          )
        }
      }
    )
  }

  WhenBooted_ObtainPW_AddExtantWalletWith_MnemonicString (
    walletLabel,
    swatch,
    mnemonicString,
    fn, // fn: (err: Error?, walletInstance: Wallet, wasWalletAlreadyInserted: Bool?) -> Void
    optl__userCanceledPasswordEntry_fn
  ) {
    console.log('WalletsListControllerBase: WhenBooted_ObtainPW_AddExtantWalletWith_MnemonicString invoked')
    const userCanceledPasswordEntry_fn = optl__userCanceledPasswordEntry_fn || function () {}
    const self = this
    const context = self.context
    self.ExecuteWhenBooted(
      function () {
        context.passwordController.WhenBootedAndPasswordObtained_PasswordAndType( // this will block until we have access to the pw
          function (obtainedPasswordString, userSelectedTypeOfPassword) {
            _proceedWithPassword(obtainedPasswordString)
          },
          function () { // user canceled
            userCanceledPasswordEntry_fn()
          }
        )
        function _proceedWithPassword (persistencePassword) {
          const walletAlreadyExists = false
          const wallets_length = self.records.length
          for (let i = 0; i < wallets_length; i++) {
            const wallet = self.records[i]
            if (!wallet.mnemonicString || typeof wallet.mnemonicString === 'undefined') {
              continue // TODO: solve limitation of this code; how to check if wallet with same address (but no mnemonic) was already added?
            }
            if (self.context.monero_utils.are_equal_mnemonics(mnemonicString, wallet.mnemonicString)) {
              // simply return existing wallet
              fn(null, wallet, true) // wasWalletAlreadyInserted: true
              return
            }
          }
          //
          const options =
					{
					  failedToInitialize_cb: function (err, walletInstance) {
					    fn(err)
					  },
					  successfullyInitialized_cb: function (walletInstance) {
					    walletInstance.Boot_byLoggingIn_existingWallet_withMnemonic(
					      persistencePassword,
					      walletLabel,
					      swatch,
					      mnemonicString,
					      false, // not forServerChange
					      function (err) {
					        if (err) {
					          fn(err)
					          return
					        }
					        self._atRuntime__record_wasSuccessfullySetUpAfterBeingAdded(walletInstance)
					        //
					        fn(null, walletInstance, false) // wasWalletAlreadyInserted: false
					      }
					    )
					  },
					  //
					  didReceiveUpdateToAccountInfo: function () { // TODO: bubble?
					  },
					  didReceiveUpdateToAccountTransactions: function () { // TODO: bubble?
					  }
					}
          console.log('About to invoke new Wallet(options, context)')
          // console.log(options)
          // console.log(context)
          const wallet = new Wallet(options, context)
        }
      }
    )
  }

  WhenBooted_ObtainPW_AddExtantWalletWith_AddressAndKeys (
    walletLabel,
    swatch,
    address,
    view_key__private,
    spend_key__private,
    fn, // fn: (err: Error?, walletInstance: Wallet, wasWalletAlreadyInserted: Bool?) -> Void
    optl__userCanceledPasswordEntry_fn
  ) {
    console.log('WalletsListControllerBase: WhenBooted_ObtainPW_AddExtantWalletWith_AddressAndKeys invoked')
    const userCanceledPasswordEntry_fn = optl__userCanceledPasswordEntry_fn || function () {}
    const self = this
    const context = self.context
    self.ExecuteWhenBooted(
      function () {
        context.passwordController.WhenBootedAndPasswordObtained_PasswordAndType( // this will block until we have access to the pw
          function (obtainedPasswordString, userSelectedTypeOfPassword) {
            _proceedWithPassword(obtainedPasswordString)
          },
          function () { // user canceled
            userCanceledPasswordEntry_fn()
          }
        )
        function _proceedWithPassword (persistencePassword) {
          const walletAlreadyExists = false
          console.log(self.records)
          const wallets_length = self.records.length
          for (let i = 0; i < wallets_length; i++) {
            const wallet = self.records[i]
            if (wallet.public_address === address) {
              // simply return existing wallet; note: this wallet might have mnemonic and thus seed
              // so might not be exactly what consumer of WhenBooted_ObtainPW_AddExtantWalletWith_AddressAndKeys is expecting
              fn(null, wallet, true) // wasWalletAlreadyInserted: true
              return
            }
          }
          //
          const options =
					{
					  failedToInitialize_cb: function (err, walletInstance) {
					    fn(err)
					  },
					  successfullyInitialized_cb: function (walletInstance) {
					    walletInstance.Boot_byLoggingIn_existingWallet_withAddressAndKeys(
					      persistencePassword,
					      walletLabel,
					      swatch,
					      address,
					      view_key__private,
					      spend_key__private,
					      false, // not forServerChange
					      function (err) {
					        if (err) {
					          fn(err)
					          return
					        }
					        self._atRuntime__record_wasSuccessfullySetUpAfterBeingAdded(walletInstance)
					        //
					        fn(null)
					      }
					    )
					  },
					  //
					  didReceiveUpdateToAccountInfo: function () { // TODO: bubble?
					  },
					  didReceiveUpdateToAccountTransactions: function () { // TODO: bubble?
					  }
					}
          const wallet = new Wallet(options, context)
        }
      }
    )
  }

  //
  // Runtime - Imperatives - Private - Event observation - Wallets
  overridable_startObserving_record (record) {
    super.overridable_startObserving_record(record)
    const wallet = record
    const record_initTimeInstanceUUID = record.initTimeInstanceUUID
    if (record_initTimeInstanceUUID == null || typeof record_initTimeInstanceUUID === 'undefined' || record_initTimeInstanceUUID == '') {
      throw 'Expected non-zero record_initTimeInstanceUUID'
    }
    const self = this
    // we need to be able to stop observing a wallet when the user deletes it (as we free the wallet),
    // so we have to hang onto the listener function
    { // balanceChanged
      if (typeof self.wallet_listenerFnsByWalletId_balanceChanged === 'undefined') {
        self.wallet_listenerFnsByWalletId_balanceChanged = {}
      }
      const fn = function (emittingWallet, old_total_received, old_total_sent, old_locked_balance) {
        self.emit(self.EventName_aWallet_balanceChanged(), emittingWallet, old_total_received, old_total_sent, old_locked_balance)
      }
      self.wallet_listenerFnsByWalletId_balanceChanged[record_initTimeInstanceUUID] = fn
      wallet.on(wallet.EventName_balanceChanged(), fn)
    }
    { // transactionsAdded
      if (typeof self.wallet_listenerFnsByWalletId_transactionsAdded === 'undefined') {
        self.wallet_listenerFnsByWalletId_transactionsAdded = {}
      }
      const fn = function (emittingWallet, numberOfTransactionsAdded, newTransactions) {
        self.emit(self.EventName_aWallet_transactionsAdded(), emittingWallet, numberOfTransactionsAdded, newTransactions)
      }
      self.wallet_listenerFnsByWalletId_transactionsAdded[record_initTimeInstanceUUID] = fn
      wallet.on(wallet.EventName_transactionsAdded(), fn)
    }
  }

  overridable_stopObserving_record (record) {
    super.overridable_stopObserving_record(record)
    const wallet = record
    const record_initTimeInstanceUUID = record.initTimeInstanceUUID
    if (record_initTimeInstanceUUID == null || typeof record_initTimeInstanceUUID === 'undefined' || record_initTimeInstanceUUID == '') {
      throw 'Expected non-zero record_initTimeInstanceUUID'
    }
    const self = this
    { // balanceChanged
      const fn = self.wallet_listenerFnsByWalletId_balanceChanged[record_initTimeInstanceUUID]
      if (typeof fn === 'undefined') {
        throw "listener shouldn't have been undefined"
      }
      wallet.removeListener(wallet.EventName_balanceChanged(), fn)
    }
    { // transactionsAdded
      const fn = self.wallet_listenerFnsByWalletId_transactionsAdded[record_initTimeInstanceUUID]
      if (typeof fn === 'undefined') {
        throw "listener shouldn't have been undefined"
      }
      wallet.removeListener(wallet.EventName_transactionsAdded(), fn)
    }
  }

  //
  // Delegation - Events
  settingsChanged_specificAPIAddressURLAuthority () {
    const self = this
    // 'log out' all wallets by grabbing their keys (info to reconstitute them), deleting them, then reconstituting and booting them
    // I opted to do this here rather than within the wallet itself b/c if a wallet is currently logging in then it has to manage cancelling that, etc. - was easier and possibly simpler to just use List CRUD apis instead.
    const wallets_length = self.records.length
    if (self.hasBooted == false) {
      if (wallets_length != 0) {
        throw 'Expected there to be no records while controller not booted' // this is probably overkill
      }
      return // nothing to do
    }
    if (wallets_length == 0) {
      return // nothing to do
    }
    if (self.context.passwordController.HasUserEnteredValidPasswordYet() === false) {
      throw 'App expected password to exist as wallets exist'
    }
    self.context.passwordController.WhenBootedAndPasswordObtained_PasswordAndType( // this will block until we have access to the pw
      function (obtainedPasswordString, userSelectedTypeOfPassword) {
        const numberOf_walletsToDelete = self.records.length
        for (let i = 0; i < numberOf_walletsToDelete; i++) {
          const wallet = self.records[i]
          wallet.logOutAndSaveThenLogBackIn(obtainedPasswordString)
        }
        self.__listUpdated_records()
      }
    )
  }
}
export default WalletsListController
