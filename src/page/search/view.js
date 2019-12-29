import React from 'react';
import { Lbry, createNormalizedClaimSearchKey, parseURI, normalizeURI, isURIValid } from 'lbry-redux';
import {
  ActivityIndicator,
  Button,
  FlatList,
  NativeModules,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { navigateToUri } from 'utils/helper';
import Colors from 'styles/colors';
import Constants from 'constants'; // eslint-disable-line node/no-deprecated-api
import PageHeader from 'component/pageHeader';
import FileListItem from 'component/fileListItem';
import FloatingWalletBalance from 'component/floatingWalletBalance';
import UriBar from 'component/uriBar';
import searchStyle from 'styles/search';

class SearchPage extends React.PureComponent {
  state = {
    currentQuery: null,
    currentUri: null,
    showTagResult: false,
    claimSearchRun: false,
    claimSearchOptions: null,
    resultsResolved: false,
  };

  static navigationOptions = {
    title: 'Search Results',
  };

  didFocusListener;

  componentWillMount() {
    const { navigation } = this.props;
    // this.didFocusListener = navigation.addListener('didFocus', this.onComponentFocused);
  }

  componentWillUnmount() {
    if (this.didFocusListener) {
      this.didFocusListener.remove();
    }
  }

  onComponentFocused = () => {
    const { pushDrawerStack, setPlayerVisible, query, search } = this.props;
    pushDrawerStack();
    setPlayerVisible();
    NativeModules.Firebase.setCurrentScreen('Search').then(result => {
      const searchQuery = query || this.getSearchQuery();
      if (searchQuery && searchQuery.trim().length > 0) {
        this.setState({
          currentQuery: searchQuery,
          currentUri: isURIValid(searchQuery) ? normalizeURI(searchQuery) : null,
          claimSearchOptions: null,
          claimSearchRun: false,
          showTagResult: false,
        });
        search(searchQuery);
      }
    });
  };

  componentDidMount() {
    this.onComponentFocused();
  }

  componentWillReceiveProps(nextProps) {
    const { currentRoute, query } = nextProps;
    const { currentRoute: prevRoute, search } = this.props;

    if (Constants.DRAWER_ROUTE_SEARCH === currentRoute && currentRoute !== prevRoute) {
      this.onComponentFocused();
    }

    if (query && query.trim().length > 0 && query !== this.state.currentQuery) {
      this.setState({
        currentQuery: query,
        currentUri: isURIValid(query) ? normalizeURI(query) : null,
        resultsResolved: false,
      });
      search(query);
    }
  }

  allContentResolved() {
    const { uris, resolvingUris } = this.props;
    if (!this.state.resultsResolved) {
      return false;
    }
    if (uris) {
      let allResolved = true;
      uris.forEach(uri => {
        allResolved = allResolved && !resolvingUris.includes(uri);
      });
      return allResolved;
    }

    return false;
  }

  shouldComponentUpdate() {
    const { isSearching, uris } = this.props;
    return (isSearching && (!uris || uris.length === 0)) || (!isSearching && this.allContentResolved());
  }

  componentDidUpdate() {
    const { isSearching, resolveUris, uris } = this.props;
  }

  getSearchQuery() {
    const { navigation } = this.props;
    if (navigation && navigation.state && navigation.state.params) {
      return navigation.state.params.searchQuery;
    }
    return null;
  }

  handleSearchSubmitted = keywords => {
    const { search } = this.props;
    this.setState({
      currentUri: isURIValid(keywords) ? normalizeURI(keywords) : null,
      claimSearchOptions: null,
      claimSearchRun: false,
      showTagResult: false,
    });
    search(keywords);
  };

  listEmptyComponent = () => {
    const { query } = this.props;
    return (
      <View style={searchStyle.noResults}>
        <Text style={searchStyle.noResultsText}>
          {__('There are no results to display for "%query%". Please try a different search term.', { query })}
        </Text>
      </View>
    );
  };

  listHeaderComponent = showTagResult => {
    const { navigation, claimSearch, claimSearchByQuery } = this.props;
    const { currentUri } = this.state;
    const query = this.getSearchQuery();

    const canBeTag = query && query.trim().length > 0 && isURIValid(query);
    if (canBeTag && !this.state.claimSearchRun) {
      const options = {
        any_tags: [query],
        page: 1,
        no_totals: true,
      };
      this.setState({ claimSearchOptions: options, claimSearchRun: true }, () => claimSearch(options));
    }

    /* if (this.state.claimSearchRun && this.state.claimSearchOptions) {
      const claimSearchKey = createNormalizedClaimSearchKey(this.state.claimSearchOptions);
      const claimSearchUris = claimSearchByQuery[claimSearchKey];
      this.setState({ showTagResult: claimSearchUris && claimSearchUris.length > 0 });
    } */

    return (
      <View>
        <FileListItem uri={currentUri} featuredResult style={searchStyle.featuredResultItem} navigation={navigation} />
        {showTagResult && (
          <TouchableOpacity style={searchStyle.tagResultItem} onPress={() => this.handleTagResultPressed(query)}>
            <Text style={searchStyle.tagResultTitle}>#{query.toLowerCase()}</Text>
            <Text style={searchStyle.tagResultDescription}>{__('Explore content for this tag')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  handleTagResultPressed = tag => {
    const { navigation } = this.props;
    navigation.navigate({ routeName: Constants.DRAWER_ROUTE_TAG, key: `tagPage`, params: { tag: tag.toLowerCase() } });
  };

  render() {
    const { isSearching, navigation, query, uris } = this.props;

    return (
      <View style={searchStyle.container}>
        <UriBar value={query} navigation={navigation} onSearchSubmitted={this.handleSearchSubmitted} />

        {isSearching && (
          <View style={searchStyle.busyContainer}>
            <ActivityIndicator size="large" color={Colors.NextLbryGreen} style={searchStyle.loading} />
          </View>
        )}

        {!isSearching && (
          <FlatList
            extraData={this.state}
            style={searchStyle.scrollContainer}
            contentContainerStyle={searchStyle.scrollPadding}
            keyboardShouldPersistTaps={'handled'}
            data={uris}
            keyExtractor={(item, index) => item}
            initialNumToRender={8}
            maxToRenderPerBatch={20}
            removeClippedSubviews
            ListEmptyComponent={!isSearching ? this.listEmptyComponent() : null}
            ListHeaderComponent={this.state.currentUri ? this.listHeaderComponent(this.state.showTagResult) : null}
            renderItem={({ item }) => (
              <FileListItem
                key={item}
                uri={item}
                style={searchStyle.resultItem}
                batchResolve
                navigation={navigation}
              />
            )}
          />
        )}
        <FloatingWalletBalance navigation={navigation} />
      </View>
    );
  }
}

export default SearchPage;
